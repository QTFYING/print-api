/**
 * 脏数据体检（第 3 步「ETL 出口标准」的前半）：对 legacy 副本层做列级画像，
 * 产出「清洗规则该写哪几条」的唯一实证依据——不靠文档印象，靠库里到底存了什么。
 *
 * 用法：node scripts/etl/recon/profile-columns.mjs [--prefix pe] [--limit 200] [--top 25]
 * 结果写入 etl.column_profile（幂等：同 (legacy_table,column_name) 覆盖更新）。
 */
import { pool, close } from '../lib/db.mjs';

const argv = process.argv.slice(2);
const getOpt = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const prefixFilter = getOpt('prefix');
const limit = Number(getOpt('limit') ?? 400);
const topN = Number(getOpt('top') ?? 25);

await pool.query(`
CREATE TABLE IF NOT EXISTS etl.column_profile (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_db     text NOT NULL,
  legacy_table  text NOT NULL,
  column_name   text NOT NULL,
  total         bigint NOT NULL DEFAULT 0,
  nulls         bigint NOT NULL DEFAULT 0,
  empties       bigint NOT NULL DEFAULT 0,
  numeric_ok    bigint NOT NULL DEFAULT 0,
  numeric_bad   bigint NOT NULL DEFAULT 0,
  money_comma   bigint NOT NULL DEFAULT 0,
  zero_date     bigint NOT NULL DEFAULT 0,
  has_chinese   bigint NOT NULL DEFAULT 0,
  suspect_mojibake bigint NOT NULL DEFAULT 0,
  nul_marked    bigint NOT NULL DEFAULT 0,
  max_len       int NOT NULL DEFAULT 0,
  distinct_cnt  int NOT NULL DEFAULT 0,
  profiled_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legacy_table, column_name)
);
`);

const PREFIX_DB = { pe: 'printingexhibition', dev: 'dev_ems_print', wpte: 'w_pte', prt: 'print', cpz: 'chinapri_zhdj' };
/** 名字像数字/金额的列，才判 numeric 合法性，避免把备注列误报 */
const NUM_HINT = /(amount|money|price|fee|je|dk|zk|wfk|bffk|qbfk|rate|total|sum|due|pay|nums|num|jq|面积|数)/i;
const DATE_HINT = /(date|time|rq|sj|_on$|day)/i;

const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;

const tables = (
  await pool.query(
    `select table_name from information_schema.tables
      where table_schema='legacy' and table_type='BASE TABLE'
        and ($1::text is null or table_name like $1 || '__%')
      order by table_name`,
    [prefixFilter ?? null],
  )
).rows.map((r) => r.table_name);

console.log(`待画像副本表 ${tables.length} 张（上限 ${limit}），逐表列级扫描…`);

let done = 0;
let cols = 0;
const started = Date.now();

for (const t of tables.slice(0, limit)) {
  const columns = (
    await pool.query(
      `select column_name from information_schema.columns
        where table_schema='legacy' and table_name=$1 order by ordinal_position`,
      [t],
    )
  ).rows.map((r) => r.column_name);
  if (!columns.length) continue;

  const parts = columns.map((c) => {
    const col = qid(c);
    const lit = (s) => `'${String(s).replace(/'/g, "''")}'`; // SQL 字符串字面量（双引号会被当成标识符）
    const numericish = NUM_HINT.test(c) && !DATE_HINT.test(c); // 日期列不参与数字合法性判定（否则 payment*_date 会被误报）
    const dateseh = DATE_HINT.test(c);
    return [
      `select ${lit(t)} tbl, ${lit(c)} col,`,
      `count(*)::bigint total,`,
      `count(*) filter (where ${col} is null)::bigint nulls,`,
      `count(*) filter (where ${col}='')::bigint empties,`,
      numericish
        ? `count(*) filter (where ${col} ~ '^-?[0-9]+(\\.[0-9]+)?$')::bigint numeric_ok,
           count(*) filter (where ${col} is not null and ${col}<>'' and ${col} !~ '^-?[0-9]+(\\.[0-9]+)?$')::bigint numeric_bad,
           count(*) filter (where ${col} ~ '[0-9],[0-9]{3}')::bigint money_comma,`
        : `0::bigint numeric_ok, 0::bigint numeric_bad, 0::bigint money_comma,`,
      dateseh
        ? `count(*) filter (where ${col} in ('0000-00-00','0000-00-00 00:00:00'))::bigint zero_date,`
        : `0::bigint zero_date,`,
      `count(*) filter (where ${col} ~ '[\\u4e00-\\u9fa5]')::bigint has_chinese,`,
      `count(*) filter (where ${col} ~ '(Ã|â|å|Ã©|\\?\\?\\?)' and ${col} !~ '[\\u4e00-\\u9fa5]')::bigint suspect_mojibake,`,
      `count(*) filter (where ${col} like '%\\x00%')::bigint nul_marked,`,
      `coalesce(max(length(${col})),0)::int max_len,`,
      `count(distinct ${col})::int distinct_cnt`,
      `from legacy.${qid(t)}`,
    ].join(' ');
  });

  // 分批跑，避免单条 SQL 过宽（有的表 60+ 列）
  for (let i = 0; i < parts.length; i += 20) {
    const slice = parts.slice(i, i + 20);
    const res = await pool.query(slice.join('\nunion all\n'));
    for (const r of res.rows) {
      await pool.query(
        `INSERT INTO etl.column_profile(source_db, legacy_table, column_name, total, nulls, empties,
            numeric_ok, numeric_bad, money_comma, zero_date, has_chinese, suspect_mojibake, nul_marked, max_len, distinct_cnt)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (legacy_table, column_name)
         DO UPDATE SET total=EXCLUDED.total, nulls=EXCLUDED.nulls, empties=EXCLUDED.empties,
           numeric_ok=EXCLUDED.numeric_ok, numeric_bad=EXCLUDED.numeric_bad, money_comma=EXCLUDED.money_comma,
           zero_date=EXCLUDED.zero_date, has_chinese=EXCLUDED.has_chinese, suspect_mojibake=EXCLUDED.suspect_mojibake,
           nul_marked=EXCLUDED.nul_marked, max_len=EXCLUDED.max_len, distinct_cnt=EXCLUDED.distinct_cnt, profiled_at=now()`,
        [
          PREFIX_DB[t.split('__')[0]] ?? t.split('__')[0],
          t.split('__').slice(1).join('__'),
          r.col,
          r.total, r.nulls, r.empties, r.numeric_ok, r.numeric_bad, r.money_comma,
          r.zero_date, r.has_chinese, r.suspect_mojibake, r.nul_marked, r.max_len, r.distinct_cnt,
        ],
      );
      cols += 1;
    }
  }
  done += 1;
  if (done % 25 === 0)
    console.log(`  已画像 ${done} 表 / ${cols} 列，用时 ${Math.round((Date.now() - started) / 1000)}s`);
}

console.log(`\n画像完成：${done} 表 / ${cols} 列，用时 ${Math.round((Date.now() - started) / 1000)}s`);

console.log('\n=== 需要写清洗规则的问题排名 ===');
const findings = await pool.query(
  `select '数字列存非数字' as 问题, count(*) as 列数, sum(numeric_bad) as 受影响行数
     from etl.column_profile where numeric_bad > 0
   union all select '金额带千分位逗号', count(*), sum(money_comma) from etl.column_profile where money_comma > 0
   union all select '零日期 0000-00-00', count(*), sum(zero_date) from etl.column_profile where zero_date > 0
   union all select '数字/日期列存空串', count(*), sum(empties) from etl.column_profile where empties > 0
     and (numeric_bad > 0 or zero_date > 0 or numeric_ok > 0)
   union all select '疑似编码错乱(非中文列)', count(*), sum(suspect_mojibake) from etl.column_profile where suspect_mojibake > 0
   union all select '含 NUL 转义标记', count(*), sum(nul_marked) from etl.column_profile where nul_marked > 0
   order by 3 desc nulls last`,
);
for (const r of findings.rows)
  console.log(`  ${String(r['问题']).padEnd(24)} 列数=${String(r['列数']).padStart(5)}  受影响行数=${String(r['受影响行数'] ?? 0).padStart(8)}`);

console.log(`\n=== 最脏的 ${topN} 个列 ===`);
const worst = await pool.query(
  `select source_db, legacy_table, column_name, total, empties, numeric_bad, money_comma, zero_date, suspect_mojibake
     from etl.column_profile
    where numeric_bad + money_comma + zero_date + suspect_mojibake > 0
    order by numeric_bad + money_comma + zero_date + suspect_mojibake desc limit $1`,
  [topN],
);
for (const r of worst.rows)
  console.log(
    `  ${(r.source_db + '.' + r.legacy_table + '.' + r.column_name).padEnd(56)} 总=${String(r.total).padStart(6)} 空=${String(r.empties).padStart(6)} 非数字=${String(r.numeric_bad).padStart(6)} 逗号=${String(r.money_comma).padStart(5)} 零日期=${String(r.zero_date).padStart(5)} 乱码=${r.suspect_mojibake}`,
  );

await close();
