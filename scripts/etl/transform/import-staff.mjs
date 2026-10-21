/**
 * 员工账号归并（§7 统一账户 / §9 RBAC）：把副本层 legacy.pe__expo_admin 的 29 个真实账号
 * 导入新模 member + member_identity(STAFF) + staff_profile + member_role。
 *
 * 注意：Prisma 的 @default(uuid(7)) 由客户端生成，裸 SQL 插入必须自带 id（这里用 gen_random_uuid()）。
 *
 * 刻意不做（写进交接文档，避免接手方误以为已完成）：
 *   - hall01~20 → data_scope：展馆主档 show_hall 属届次域，尚未从副本 transform 进新模，
 *     此时硬造 data_scope 只会写入无意义外键。等届次域映射完成后回填。
 *   - 不把旧 MD5 当可用口令：旧哈希留在 legacy_account 供兼容校验，member 侧 must_change_password=true。
 * 用法：node scripts/etl/transform/import-staff.mjs
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 3 });

/** 带 id 默认值的插入 helper（uuid 由 DB 生成；列名统一加引号，避开 group 等保留字） */
async function insertWithId(table, data, conflict, returning = 'id') {
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = vals.map((_, i) => `$${i + 1}`);
  const quoted = cols.map((c) => `"${c}"`).join(', ');
  const sql = `INSERT INTO ${table} (id, ${quoted}) VALUES (gen_random_uuid(), ${placeholders.join(', ')})${
    conflict ? ` ON CONFLICT ${conflict}` : ' ON CONFLICT DO NOTHING'
  } RETURNING ${returning}`;
  const r = await pool.query(sql, vals);
  return r.rows[0]?.[returning] ?? null;
}

/** 权限码基线（取代 auth1~10 布尔位与"一个 auth4 通吃"） */
const PERMISSIONS = [
  ['probe.access', '探测端点访问', 'system'],
  ['exhibitor.read', '展商读取', 'exhibitor'],
  ['exhibitor.write', '展商维护', 'exhibitor'],
  ['contract.approve', '合同审批', 'contract'],
  ['financial.lock.toggle', '区块锁加解锁', 'financial'],
  ['export.pii', '含个人信息导出', 'export'],
];

for (const [code, name, group] of PERMISSIONS) {
  await insertWithId('permission', { code, name, group }, null);
}

const ROLE_DEFS = [
  ['SYSADMIN', '系统管理员', true, '对应旧 isadmin=1：全量权限'],
  ['STAFF', '普通员工', false, '对应旧 auth4=0：仅读取与探测'],
];
const roleIds = new Map();
for (const [code, name, isAll, desc] of ROLE_DEFS) {
  const id = await insertWithId(
    'role',
    { code, name, description: desc, is_system: isAll },
    `(code) DO UPDATE SET name = EXCLUDED.name`,
  );
  const row = await pool.query(`SELECT id FROM role WHERE code=$1`, [code]);
  roleIds.set(code, row.rows[0].id);

  // STAFF 不给 probe.access：否则「缺权限 → 403」这条防线永远测不出来（见 smoke-auth）
  const codes = isAll ? ['*', ...PERMISSIONS.map((p) => p[0])] : ['exhibitor.read', 'exhibitor.write'];
  for (const c of codes) {
    if (c === '*') continue;
    const p = await pool.query(`SELECT id FROM permission WHERE code=$1`, [c]);
    if (!p.rows[0]) continue;
    await pool.query(
      `INSERT INTO role_permission (id, role_id, permission_id) VALUES (gen_random_uuid(),$1,$2)
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [row.rows[0].id, p.rows[0].id],
    );
  }
}
console.log(`角色/权限就位：${[...roleIds].map(([k, v]) => `${k}=${v.slice(0, 8)}…`).join(' ')}`);

const admins = (
  await pool.query(
    `SELECT id, "user", email, mobile, department, title, pass, state, isadmin
       FROM legacy.pe__expo_admin ORDER BY id::int`,
  )
).rows;
console.log(`副本层真实员工 ${admins.length} 个`);

let created = 0;
let linked = 0;
for (const a of admins) {
  const email = a.email && /\S+@\S+\.\S+/.test(a.email) ? a.email.toLowerCase().trim() : null;
  const digits = String(a.mobile ?? '').replace(/[^0-9]/g, '');
  const mobile = digits.length >= 6 && digits.length <= 20 ? digits : null;
  const legacyHash = String(a.pass ?? '').trim();
  const md5Shape = /^[0-9a-f]{32}$/i.test(legacyHash);
  const roleCode = String(a.isadmin) === '1' ? 'SYSADMIN' : 'STAFF';
  const extRef = `expo_admin:${a.id}`;

  const exist = await pool.query(
    `SELECT id FROM member WHERE email=$1 OR ($2::text IS NOT NULL AND mobile=$2) LIMIT 1`,
    [email, mobile],
  );
  let memberId = exist.rows[0]?.id ?? null;
  if (memberId) linked += 1;
  else {
    memberId = await insertWithId('member', {
      display_name: a.user || `admin-${a.id}`,
      email,
      mobile,
      password_hash: md5Shape ? legacyHash : null,
      hash_algorithm: md5Shape ? 'LEGACY_MD5' : 'ARGON2ID',
      must_change_password: true,
      status: 'ACTIVE',
      legacy_ref: extRef,
      created_at: new Date(),
      updated_at: new Date(), // Prisma @updatedAt 由客户端维护，裸 SQL 必须自己给
    });
    created += 1;
  }

  await pool.query(
    `INSERT INTO member_identity (id, member_id, kind, ref_id, is_primary, verified_at)
     VALUES (gen_random_uuid(),$1,'STAFF',$2,true,now())
     ON CONFLICT (member_id, kind, ref_id) WHERE ref_id IS NOT NULL DO NOTHING`,
    [memberId, extRef],
  );
  await pool.query(
    `INSERT INTO staff_profile (id, member_id, employee_no, department, position, active)
     VALUES (gen_random_uuid(),$1,$2,$3,$4,$5)
     ON CONFLICT (member_id) DO UPDATE SET department=EXCLUDED.department, position=EXCLUDED.position, active=EXCLUDED.active`,
    [memberId, a.user, a.department || null, a.title || null, String(a.state ?? '1') !== '0'],
  );
  await pool.query(
    `INSERT INTO member_role (id, member_id, role_id, granted_at) VALUES (gen_random_uuid(),$1,$2,now())
     ON CONFLICT (member_id, role_id) DO NOTHING`,
    [memberId, roleIds.get(roleCode)],
  );
  if (md5Shape) {
    await pool.query(
      `INSERT INTO legacy_account (id, source, external_id, username, email, legacy_hash, member_id)
       VALUES (gen_random_uuid(),'expo_admin',$1,$2,$3,$4,$5)
       ON CONFLICT (source, external_id) DO UPDATE SET member_id=EXCLUDED.member_id`,
      [String(a.id), a.user, email, legacyHash, memberId],
    );
  }
}
console.log(`员工归并：新建 ${created}，命中已存在 ${linked}`);

const stat = await pool.query(`
  SELECT
    (SELECT count(*) FROM member m JOIN member_identity i ON i.member_id=m.id WHERE i.kind='STAFF') AS staff,
    (SELECT count(*) FROM legacy_account WHERE source='expo_admin') AS legacy_md5_kept,
    (SELECT count(*) FROM member m JOIN member_role r ON r.member_id=m.id JOIN role o ON o.id=r.role_id WHERE o.code='SYSADMIN') AS sysadmin,
    (SELECT count(*) FROM data_scope) AS data_scope_rows
`);
console.log('核对：', stat.rows[0]);
console.log('提示：data_scope_rows 应为 0 —— hall01~20 → 展馆数据权限待届次域 transform 后回填（见交接文档）。');
await pool.end();
