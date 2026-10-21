/**
 * 第 3 步「ETL 出口标准」的前半段：对 legacy 副本层做脏数据体检，产出可对账基线。
 *
 * 用法：node scripts/etl/recon/legacy-baseline.mjs [--only 表名关键字] [--top 10]
 * 每列统计：空值率 / 空串率 / 千分位金额 / 零日期 / 数字列里的非数字 —— 全部写入 etl.legacy_recon
 * 这是「清洗规则该写几条」的唯一可信依据，不靠猜。
 */
import { q, close } from '../lib/db.mjs';

const argv = process.argv.slice(2);
const getOpt = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const only = getOpt('only');
const top = Number(getOpt('top') ?? 12);
const sourceDb = getOpt('db') ?? 'HEALTH_CHECK';

const NUMERIC_HINT =
  /(amount|money|price|fee|je|dk|zk|rate|total|sum|due|pay|nums|num|count|id_?old|^id$|number)/i;

const tables = (
  await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='legacy' AND table_type='BASE TABLE'
        AND ($1::text IS NULL OR table_name LIKE '%'||$1||'%')
      ORDER BY table_name`,
    [only ?? null],
  )
).rows.map((r) => r.table_name);

if (!tables.length) {
  console.log('legacy 层暂无表：等甲方 dump 到位后先跑 load-tab.mjs');
  await close();
  process.exit(0);
}
console.log(`对 ${tables.length} 张 legacy 表做脏数据体检…`);

// 体检也要落台账：ON CONFLICT 依赖 batch_id 非空，故先取/建一个批次
const batchRow = await q(
  `INSERT INTO etl.dump_batch(source_db, kind, status, note)
   VALUES ($1,'recon_snapshot','VERIFIED','脏数据体检快照')
   ON CONFLICT (source_db, kind, sha256) DO NOTHING
   RETURNING id`,
  [sourceDb],
);
let batchId = batchRow.rows[0]?.id ?? null;
if (!batchId) {
  batchId = (
    await q(`SELECT id FROM etl.dump_batch WHERE source_db=$1 AND kind='recon_snapshot' ORDER BY received_at DESC LIMIT 1`, [sourceDb])
  ).rows[0].id;
}

const allFindings = [];
for (const t of tables) {
  const cols = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='legacy' AND table_name=$1 ORDER BY ordinal_position`,
      [t],
    )
  ).rows.map((r) => r.column_name);
  if (!cols.length) continue;

  const perCol = cols.map((c) => {
    const col = `"${c}"`;
    const looksNumeric = NUMERIC_HINT.test(c);
    return [
      `SELECT ${JSON.stringify(t)} AS tbl, ${JSON.stringify(c)} AS col,`,
      `count(*)::bigint AS total,`,
      `count(*) FILTER (WHERE ${col} IS NULL)::bigint AS nulls,`,
      `count(*) FILTER (WHERE ${col}='')::bigint AS empties,`,
      `count(*) FILTER (WHERE ${col} ~ '[0-9],[0-9]')::bigint AS money_comma,`,
      `count(*) FILTER (WHERE ${col} IN ('0000-00-00','0000-00-00 00:00:00'))::bigint AS zero_date,`,
      `count(*) FILTER (WHERE ${col} ~ '[^\x00-\x7F]' AND ${col} !~ '[\\u4e00-\\u9fa5]')::bigint AS suspect_gbk`,
      looksNumeric
        ? `,count(*) FILTER (WHERE ${col} <> '' AND ${col} !~ '^-?[0-9]+(\\.[0-9]+)?$')::bigint AS non_numeric`
        : `,0::bigint AS non_numeric`,
    ].join(' ');
  });

  const res = await q(perCol.join('\nUNION ALL\n'));
  const dirty = {};
  for (const r of res.rows) {
    const total = Number(r.total) || 1;
    const f = {
      column: r.col,
      total: Number(r.total),
      null_rate: +(Number(r.nulls) / total).toFixed(4),
      empty_rate: +(Number(r.empties) / total).toFixed(4),
      money_comma: Number(r.money_comma),
      zero_date: Number(r.zero_date),
      non_numeric: Number(r.non_numeric),
      suspect_gbk: Number(r.suspect_gbk),
    };
    dirty[r.col] = f;
    for (const k of ['money_comma', 'zero_date', 'non_numeric', 'suspect_gbk']) {
      if (f[k] > 0) allFindings.push({ table: t, column: r.col, kind: k, count: f[k] });
    }
    if (f.non_numeric > 0) allFindings.push({ table: t, column: r.col, kind: 'non_numeric', count: f.non_numeric });
  }
  const rows = Number(res.rows[0]?.total ?? 0);
  await q(
    `INSERT INTO etl.legacy_recon(batch_id, legacy_table, source_db, row_count, null_profile, dirty_report)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (batch_id, legacy_table)
     DO UPDATE SET row_count=EXCLUDED.row_count, null_profile=EXCLUDED.null_profile,
                   dirty_report=EXCLUDED.dirty_report, snapshotted_at=now()`,
    [batchId, t, sourceDb, rows, JSON.stringify(dirty), JSON.stringify({ dirty_columns: Object.keys(dirty).length })],
  );
  console.log(`  ${t.padEnd(44)} ${String(rows).padStart(9)} 行 / ${cols.length} 列`);
}

allFindings.sort((a, b) => b.count - a.count);
console.log(`\n脏数据命中最多的 ${top} 项（清洗规则按这个排序写）：`);
for (const f of allFindings.slice(0, top)) {
  console.log(`  ${f.kind.padEnd(14)} ${f.table}.${f.column}`.padEnd(70) + `${f.count} 处`);
}
console.log(`\n合计 ${allFindings.length} 个脏数据点`);
await close();
