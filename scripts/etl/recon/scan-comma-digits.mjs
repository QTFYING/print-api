/**
 * 全列无差别扫描：验证「金额以带千分位逗号字符串存库」这条既有判断是否成立。
 * 不按列名启发式，逐列查 '[0-9],[0-9]' 命中，避免漏掉命名不含 money 的金额列。
 * 用法：node scripts/etl/recon/scan-comma-digits.mjs
 */
import { pool, close } from '../lib/db.mjs';

const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** 命中结果落表，便于按 bak/非 bak、按库切片统计（不能只靠打印） */
await pool.query(`
CREATE TABLE IF NOT EXISTS etl.comma_scan_hit (
  source_db    text NOT NULL,
  legacy_table text NOT NULL,
  column_name  text NOT NULL,
  total        bigint NOT NULL,
  hits         bigint NOT NULL,
  sample       text,
  classified   text,                 -- MONEY / CODELIST / OTHER（人工可复核修正）
  scanned_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_db, legacy_table, column_name)
);`);
await pool.query(`DELETE FROM etl.comma_scan_hit`);

const PREFIX_DB = { pe: 'printingexhibition', dev: 'dev_ems_print', wpte: 'w_pte', prt: 'print', cpz: 'chinapri_zhdj' };
/** 金额列判定不靠列名猜：先看是否形如 1,234.56（小数收尾）；多值分类码列表形如 9,14 */
function classify(sample) {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(sample)) return 'MONEY';
  if (/^[\d,\s]+$/.test(sample) && !/\.\d/.test(sample)) return 'CODELIST';
  return 'OTHER';
}

const tables = (
  await pool.query(
    `select table_name from information_schema.tables
      where table_schema='legacy' and table_type='BASE TABLE' order by table_name`,
  )
).rows.map((r) => r.table_name);

let hitCols = 0;
let hitRows = 0;
const samples = [];
const started = Date.now();

for (const t of tables) {
  const cols = (
    await pool.query(
      `select column_name from information_schema.columns
        where table_schema='legacy' and table_name=$1 order by ordinal_position`,
      [t],
    )
  ).rows.map((r) => r.column_name);
  if (!cols.length) continue;

  const parts = cols.map((c) => {
    const col = qid(c);
    return `select ${lit(t)} tbl, ${lit(c)} col, count(*)::bigint total,
       count(*) filter (where ${col} ~ '[0-9],[0-9]')::bigint comma_hits
     from legacy.${qid(t)}`;
  });

  for (let i = 0; i < parts.length; i += 25) {
    const res = await pool.query(parts.slice(i, i + 25).join('\nunion all\n'));
    for (const r of res.rows) {
      const n = Number(r.comma_hits);
      if (n > 0) {
        hitCols += 1;
        hitRows += n;
        const s = await pool.query(
          `select ${qid(r.col)} as v from legacy.${qid(r.tbl)} where ${qid(r.col)} ~ '[0-9],[0-9]' limit 1`,
        );
        const v = String(s.rows[0]?.v ?? '');
        const kind = classify(v);
        await pool.query(
          `INSERT INTO etl.comma_scan_hit(source_db, legacy_table, column_name, total, hits, sample, classified)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (source_db, legacy_table, column_name)
           DO UPDATE SET hits=EXCLUDED.hits, total=EXCLUDED.total, sample=EXCLUDED.sample,
                         classified=EXCLUDED.classified, scanned_at=now()`,
          [PREFIX_DB[r.tbl.split('__')[0]] ?? r.tbl.split('__')[0], r.tbl.split('__').slice(1).join('__'), r.col, r.total, n, v.slice(0, 60), kind],
        );
        samples.push({ col: `${r.tbl}.${r.col}`, hits: n, total: Number(r.total), sample: v.slice(0, 40), kind });
      }
    }
  }
}

samples.sort((a, b) => b.hits - a.hits);
console.log(`扫描 ${tables.length} 张副本表，用时 ${Math.round((Date.now() - started) / 1000)}s`);
console.log(`命中「数字,数字」模式的列 = ${hitCols}，累计行数 = ${hitRows}`);
if (samples.length) {
  console.log('\nTop 15：');
  for (const s of samples.slice(0, 15))
    console.log(`  ${s.col.padEnd(52)} ${String(s.hits).padStart(6)}/${String(s.total).padStart(6)}  例: ${s.sample}`);
} else {
  console.log('\n未发现任何「数字,数字」形态的值。');
}
await close();
