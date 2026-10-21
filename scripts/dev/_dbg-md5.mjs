/** 定位 MD5 兼容登录失败的真因：插一个已知 MD5 的账号，打印登录响应体与库内实际存的哈希 */
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const tag = randomUUID().slice(0, 8);
const email = `dbg-${tag}@smoke.local`;
const pw = 'Legacy#Old123';
const md5 = createHash('md5').update(pw).digest('hex');

await pool.query(
  `INSERT INTO member (id, display_name, email, password_hash, hash_algorithm, must_change_password, status, created_at, updated_at)
   VALUES (gen_random_uuid(),$1,$2,$3,'LEGACY_MD5',false,'ACTIVE',now(),now())`,
  [`dbg-${tag}`, email, md5],
);
const stored = await pool.query(`SELECT password_hash, hash_algorithm, status, must_change_password FROM member WHERE email=$1`, [email]);
console.log('期望 md5 :', md5, 'len', md5.length);
console.log('库内哈希 :', stored.rows[0].password_hash, 'len', stored.rows[0].password_hash?.length);
console.log('是否相等 :', stored.rows[0].password_hash === md5);

const r = await fetch(`http://127.0.0.1:${env.PORT ?? 4000}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: email, password: pw, channel: 'oss' }),
});
console.log('登录 status:', r.status);
console.log('登录响应体:', JSON.stringify(await r.json()).slice(0, 300));

await pool.query(`DELETE FROM member WHERE email=$1`, [email]);
await pool.end();
