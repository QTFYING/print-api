/** 生成「未映射 23 列语义反推」SQL（副本层实测：填充率/去重数/样例） */
import { writeFileSync } from 'node:fs';

const cols = [
  'enterprise_id', 'user_id', 'exhibitors001', 'exhibitors024_2', 'order_ident', 'ident_date',
  'group_Remark', 'itma_login', 'itma02_1_0', 'itma02_1_1', 'itma02_1_2', 'itma06_file_sname',
  'itma06_fileuptime', 'shenhe', 'shenhe_yy', 'jiage01', 'jiage02', 'jiage03', 'jiage04', 'jiage05',
  'payment1_note', 'payment2_note', 'keywords',
];

const parts = cols.map(
  (c) =>
    `select '${c}' as col,
        count(*) filter (where "${c}" is not null and "${c}"<>'') as filled,
        count(distinct "${c}") as distinct_cnt,
        left(max(nullif("${c}",'')),26) as sample_max,
        left(min(nullif("${c}",'')),26) as sample_min
      from legacy.pe__expo_exhibitors`,
);

writeFileSync('D:/Projects/printchina/tmp-sem.sql', parts.join('\nunion all\n') + '\norder by filled desc;\n');
console.log(`生成 ${cols.length} 列的语义反推 SQL`);
