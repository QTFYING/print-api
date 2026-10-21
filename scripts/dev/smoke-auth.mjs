/**
 * 鉴权基座冒烟（M1）：验证 §9 的 S6/S7 防线真的生效。
 * 自测账号跑完即删（不是业务样例数据，仅工具验证），真实员工账号由 import-staff.mjs 负责。
 * 断言：
 *   1) 无 token 访问受保护路由 → 401（全局默认拒绝）
 *   2) @Public 路由仍可用 → 200
 *   3) argon2id 登录 → 200 + Bearer token；/auth/me 回权限与身份
 *   4) 缺权限码 → 403；补权限码后 → 200（RBAC 生效）
 *   5) 登出后原 token 立即失效 → 401（Redis 吊销表生效）
 *   6) 旧无盐 MD5 口令可登录但强制改密（legacyPassword=true）
 *   7) 连错 5 次 → 账号锁定（失败锁定）
 * 用法：node scripts/dev/smoke-auth.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';

// argon2 装在 apps/server 下（应用运行时依赖），脚本从仓根跑要显式解析
const require2 = createRequire(`${process.cwd()}/apps/server/package.json`);
const argon2 = require2('argon2');

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const BASE = `http://127.0.0.1:${process.env.PORT ?? env.PORT ?? 4000}/api/v1`;
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 2 });
const tag = randomUUID().slice(0, 8);
const PW = 'Smoke#Strong2026';
const MD5PW = 'Legacy#Old123';

let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}${extra ? ` · ${extra}` : ''}`);
  if (!cond) failed += 1;
};
const api = async (path, init = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  let body = null;
  try { body = await r.json(); } catch { /* 非 JSON */ }
  return { status: r.status, body, headers: r.headers };
};

const emails = [];
try {
  // 自测账号 A：argon2id，角色 STAFF（无 probe.access）
  const idA = await pool.query(
    `INSERT INTO member (id, display_name, email, password_hash, hash_algorithm, must_change_password, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'ARGON2ID', false, 'ACTIVE', now(), now()) RETURNING id`,
    [`smoke-a-${tag}`, `smoke-a-${tag}@smoke.local`, await argon2.hash(PW, { type: argon2.argon2id })],
  );
  const memberA = idA.rows[0].id;
  emails.push(`smoke-a-${tag}@smoke.local`);

  // 自测账号 B：旧无盐 MD5（验证兼容校验 + 强制改密）
  await pool.query(
    `INSERT INTO member (id, display_name, email, password_hash, hash_algorithm, must_change_password, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'LEGACY_MD5', false, 'ACTIVE', now(), now())`,
    [`smoke-b-${tag}`, `smoke-b-${tag}@smoke.local`, createHash('md5').update(MD5PW).digest('hex')],
  );
  emails.push(`smoke-b-${tag}@smoke.local`);

  const staffRole = await pool.query(`SELECT id FROM role WHERE code='STAFF'`);
  await pool.query(
    `INSERT INTO member_role (id, member_id, role_id, granted_at) VALUES (gen_random_uuid(),$1,$2,now())`,
    [memberA, staffRole.rows[0].id],
  );
  const probePerm = await pool.query(`SELECT id FROM permission WHERE code='probe.access'`);

  // 1) 默认拒绝
  const r1 = await api('/auth/me');
  ok('无 token 访问 /auth/me → 401', r1.status === 401, `实得 ${r1.status}`);
  const r1b = await api('/auth/probe');
  ok('无 token 访问 /auth/probe → 401', r1b.status === 401, `实得 ${r1b.status}`);
  // 2) 公开路由
  const r2 = await api('/health');
  ok('@Public 路由 /health 仍可用 → 200', r2.status === 200);

  // 3) argon2id 登录（跨源通道：返回 Bearer）
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: `smoke-a-${tag}@smoke.local`, password: PW, channel: 'oss' }),
  });
  const token = login.body?.accessToken;
  ok('argon2id 登录成功并拿到 access token', login.status === 201 && !!token, `status=${login.status}`);
  ok('新账号不要求强制改密', login.body?.mustChangePassword === false);

  const me = await api('/auth/me', { headers: { authorization: `Bearer ${token}` } });
  ok('带 Bearer 访问 /auth/me → 200', me.status === 200, `status=${me.status}`);
  ok('/auth/me 返回权限码集合', Array.isArray(me.body?.permissions), `perms=${me.body?.permissions?.length ?? 0}`);

  // 4) RBAC：STAFF 角色无 probe.access → 403；补权限 → 200
  const probe403 = await api('/auth/probe', { headers: { authorization: `Bearer ${token}` } });
  ok('缺权限码访问 /auth/probe → 403', probe403.status === 403, `status=${probe403.status}`);
  await pool.query(
    `INSERT INTO role_permission (id, role_id, permission_id) VALUES (gen_random_uuid(),$1,$2)
     ON CONFLICT (role_id, permission_id) DO NOTHING`,
    [staffRole.rows[0].id, probePerm.rows[0].id],
  );
  const probe200 = await api('/auth/probe', { headers: { authorization: `Bearer ${token}` } });
  ok('授予 probe.access 后 → 200（RBAC 即时生效）', probe200.status === 200, `status=${probe200.status}`);

  // 5) 登出 → token 吊销
  const logout = await api('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { authorization: `Bearer ${token}` },
  });
  ok('登出返回 201', logout.status === 201, `status=${logout.status}`);
  const afterLogout = await api('/auth/me', { headers: { authorization: `Bearer ${token}` } });
  ok('登出后原 access token 立即失效 → 401（Redis 吊销表）', afterLogout.status === 401, `status=${afterLogout.status}`);

  // 6) 旧 MD5 兼容登录 + 强制改密
  const legacyLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: `smoke-b-${tag}@smoke.local`, password: MD5PW, channel: 'oss' }),
  });
  ok('旧无盐 MD5 口令可登录（兼容校验）', legacyLogin.status === 201 && !!legacyLogin.body?.accessToken, `status=${legacyLogin.status}`);
  ok('旧 MD5 账号被要求强制改密', legacyLogin.body?.mustChangePassword === true && legacyLogin.body?.legacyPassword === true);

  // 7) 失败锁定
  for (let i = 0; i < 5; i += 1) {
    await api('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: `smoke-a-${tag}@smoke.local`, password: 'wrong-password-xxx' }) });
  }
  const locked = await api('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: `smoke-a-${tag}@smoke.local`, password: PW }) });
  ok('连错 5 次后正确口令也被锁定（401 ACCOUNT_LOCKED）', locked.status === 401, `status=${locked.status}`);

  // 8) 真实员工账号已归并（不验证口令，只验证数据在位）
  const staffCount = await pool.query(
    `SELECT count(*)::int n FROM member m JOIN member_identity i ON i.member_id=m.id WHERE i.kind='STAFF'`,
  );
  ok('真实员工账号已归并进统一账户', staffCount.rows[0].n >= 25, `staff 身份 ${staffCount.rows[0].n} 条`);
} finally {
  // 按外键依赖倒序清理（Prisma 生成的是 RESTRICT 外键，顺序错就删不掉）
  const ids = (await pool.query(`SELECT id FROM member WHERE email = ANY($1::text[])`, [emails])).rows.map((r) => r.id);
  if (ids.length) {
    await pool.query(`DELETE FROM member_role WHERE member_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM member_identity WHERE member_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM staff_profile WHERE member_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM legacy_account WHERE member_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM audit_log WHERE actor_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM member WHERE id = ANY($1::uuid[])`, [ids]);
  }
  await pool.query(
    `DELETE FROM role_permission WHERE role_id = (SELECT id FROM role WHERE code='STAFF')
     AND permission_id = (SELECT id FROM permission WHERE code='probe.access')`,
  );
  console.log('· 自测账号已清理（真实员工账号保留）');
  await pool.end();
}
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
