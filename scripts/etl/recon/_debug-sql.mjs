/** 调试：复刻 profile-columns 的 SQL 生成，打印出来定位语法错误点 */
const t = 'pe__bs_area';
const cols = ['code', 'name'];
const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;
const NUM_HINT = /(amount|money|price|fee|je|dk|zk|wfk|bffk|qbfk|rate|total|sum|due|pay|nums|num|jq|面积|数)/i;
const DATE_HINT = /(date|time|rq|sj|_on$|day)/i;

const parts = cols.map((c) => {
  const col = qid(c);
  const numericish = NUM_HINT.test(c);
  const dateseh = DATE_HINT.test(c);
  return [
    `select ${JSON.stringify(t)} tbl, ${JSON.stringify(c)} col,`,
    `count(*)::bigint total,`,
    `count(*) filter (where ${col} is null)::bigint nulls,`,
    `count(*) filter (where ${col}='')::bigint empties,`,
    numericish
      ? `count(*) filter (where ${col} ~ '^-?[0-9]+(\\.[0-9]+)?$')::bigint numeric_ok,
         count(*) filter (where ${col} is not null and ${col}<>'' and ${col} !~ '^-?[0-9]+(\\.[0-9]+)?$')::bigint numeric_bad,
         count(*) filter (where ${col} ~ '[0-9],[0-9]{3}')::bigint money_comma`
      : `0::bigint numeric_ok, 0::bigint numeric_bad, 0::bigint money_comma`,
    dateseh
      ? `count(*) filter (where ${col} in ('0000-00-00','0000-00-00 00:00:00'))::bigint zero_date`
      : `0::bigint zero_date`,
    `count(*) filter (where ${col} ~ '[\\u4e00-\\u9fa5]')::bigint has_chinese,`,
    `count(*) filter (where ${col} ~ '(Ã|â|å|Ã©|\\?\\?\\?)' and ${col} !~ '[\\u4e00-\\u9fa5]')::bigint suspect_mojibake,`,
    `count(*) filter (where ${col} like '%\\x00%')::bigint nul_marked,`,
    `coalesce(max(length(${col})),0)::int max_len,`,
    `count(distinct ${col})::int distinct_cnt`,
  ].join(' ');
});

const sql = parts.join('\nunion all\n');
console.log(sql);
console.log('\n--- 位置 220-280 ---');
console.log(JSON.stringify(sql.slice(220, 280)));
