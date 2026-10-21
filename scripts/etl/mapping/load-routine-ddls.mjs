/**
 * 把 Pass B 导出的例程/视图 TSV 存进 etl.legacy_routine_ddl。
 * 背景：真生产库存在中文命名的存储过程（如 sp_get_tj_cdfp_四舍五入版），
 *       mysqldump 8.0 客户端取 routines 会因字符集错配失败，故改走 information_schema 文本导出。
 * 用法：node scripts/etl/mapping/load-routine-ddls.mjs --db printingexhibition --file tmp-dumps/xxx_ddls.tsv
 */
import { readFileSync } from 'node:fs';
import { pool, close } from '../lib/db.mjs';

const argv = process.argv.slice(2);
const getOpt = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sourceDb = getOpt('db');
const file = getOpt('file');
if (!sourceDb || !file) {
  console.error('用法：--db <源库> --file <ddls.tsv>');
  process.exit(2);
}

let ok = 0;
let fail = 0;
const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
for (const line of lines) {
  const [kind, name, sub, body] = line.split('\t');
  if (!kind || !name) { fail += 1; continue; }
  const realKind = kind === 'ROUTINE' ? sub : kind;
  const ddl = (body ?? '').replace(/\\n/g, '\n');
  try {
    await pool.query(
      `INSERT INTO etl.legacy_routine_ddl(source_db, kind, object_name, ddl)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (source_db, kind, object_name) DO UPDATE SET ddl=EXCLUDED.ddl`,
      [sourceDb, realKind, name, ddl],
    );
    ok += 1;
  } catch (e) {
    fail += 1;
    console.log(`  ! ${realKind} ${name}: ${e.message.slice(0, 80)}`);
  }
}
console.log(`例程/视图定义入库：成功 ${ok}，失败 ${fail}（源 ${sourceDb}）`);

const sum = await pool.query(
  `select kind, count(*) from etl.legacy_routine_ddl where source_db=$1 group by 1 order by 2 desc`,
  [sourceDb],
);
for (const r of sum.rows) console.log(`  ${r.kind.padEnd(10)} ${r.count}`);

const zh = await pool.query(
  `select kind, object_name from etl.legacy_routine_ddl
    where source_db=$1 and object_name ~ '[\\u4e00-\\u9fa5]' order by 1,2`,
  [sourceDb],
);
console.log(`含中文命名的对象 ${zh.rowCount} 个：`);
for (const r of zh.rows) console.log(`  ${r.kind} ${r.object_name}`);

await close();
