/** 开发库点数：public 全表 + etl/legacy 层，确认结构与数据现状（只读） */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const meta = await client.query(
  `select current_database() db, current_user "user",
          (select setting from pg_settings where name='server_version') ver`,
);
console.log('连接目标：', meta.rows[0]);

const list = async (schema) =>
  (
    await client.query(
      `select tablename from pg_tables where schemaname=$1 order by 1`,
      [schema],
    )
  ).rows.map((r) => r.tablename);

for (const schema of ['public', 'etl', 'legacy']) {
  const tables = await list(schema);
  let total = 0;
  const nonEmpty = [];
  const qid = (s) => `"${s.replace(/"/g, '""')}"`;
  for (const t of tables) {
    const { rows } = await client.query(`select count(*)::bigint as n from ${qid(schema)}.${qid(t)}`);
    const n = Number(rows[0].n);
    total += n;
    if (n > 0) nonEmpty.push(`${schema}.${t}=${n}`);
  }
  console.log(`${schema.padEnd(8)} 表数=${String(tables.length).padStart(3)} 行数合计=${total}`);
  if (nonEmpty.length) console.log(`   非空表：${nonEmpty.join(', ')}`);
}

await client.end();
