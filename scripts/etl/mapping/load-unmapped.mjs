/**
 * 补录 §B 未覆盖的 23 列映射——语义来自副本层实测（填充率/去重数/样例），非文档推断。
 * 用法：node scripts/etl/mapping/load-unmapped.mjs
 */
import { pool, close } from '../lib/db.mjs';

const T = 'exhibitor';
const Q = 'exhibitor_qualification';
/** [旧列, 新表, 新列, 语义(含实测依据), 置信度, 转换, 待裁决] */
const M = [
  ['keywords', T, 'search_keywords', '名录搜索关键词（实测 3,686/3,693 行有值、2,629 个不同值，样例 "2PRESS"/"龙运"）→ 新模需增列，B 档名录检索直接依赖', 'HIGH', '按分隔符拆为 text[]，检索走 trigram', false],
  ['itma06_file_sname', Q, 'cert_object_key', '证书附件存储文件名（实测 87 行、值为 32 位 hex，样例 ff23af3a…）', 'HIGH', '迁 OSS 私有桶后写 objectKey', false],
  ['itma06_fileuptime', Q, 'cert_uploaded_at', '证书附件上传时间（实测 87 行，为真实时间戳，非零日期）', 'HIGH', 'timestamp', false],
  ['itma02_1_0', Q, 'listed_country', '上市国家（实测 25 行 6 值，中英混存："中国"/"China"）——文档只写"上市国家/城市"，实测为三级拆分之首', 'HIGH', '关联 code_dict；中英双值需归一', false],
  ['itma02_1_1', Q, 'listed_province_code', '上市省份代码（实测 17 行 8 值，如 810000/110000）——文档未记录此列语义', 'HIGH', '关联 geo_dict level=1', false],
  ['itma02_1_2', Q, 'listed_city_code', '上市城市代码（实测 17 行 11 值，如 810100/110100）——文档未记录此列语义', 'HIGH', '关联 geo_dict level=2', false],
  ['payment1_note', T, 'deposit_note_flag', '定金备注标志（实测 3,693 行、仅 0/1 两值）——名字像备注实为标志位，含义需甲方确认', 'UNKNOWN', '原样入 legacy_extra 并保留 0/1', true],
  ['payment2_note', T, 'balance_note_flag', '余款备注标志（实测 3,693 行、仅 0/1 两值）——同上', 'UNKNOWN', '原样入 legacy_extra 并保留 0/1', true],
  ['enterprise_id', null, null, '恒 0（实测 3,693 行全为 0，去重=1）→ 未启用，不迁', 'HIGH', '不迁（记录在案即可）', false],
  ['itma_login', null, null, '恒 0（实测 3,693 行，去重=1）→ 未启用，不迁', 'HIGH', '不迁', false],
  ['shenhe', null, null, '恒 0（实测 3,693 行，去重=1）→ 主表审核位未启用；审核实际在 expo_contract_approval(_node)', 'HIGH', '不迁；审核语义由 approval_* 承接', false],
  ['ident_date', null, null, '恒 `0000-00-00 00:00:00`（实测 3,693 行全同）→ 死列，且是零日期脏数据的一部分', 'HIGH', '不迁', false],
  ['user_id', null, null, '仅 46 行有值且全为 0 → 未启用，不迁', 'HIGH', '不迁', false],
  ['jiage01', 'legacy_extra', null, '仅 1 行有值（1700）→ 疑似价格试验列，需甲方确认是否曾用于报价', 'UNKNOWN', '原样入 JSONB', true],
  ['jiage02', 'legacy_extra', null, '仅 1 行有值（1）→ 同上', 'UNKNOWN', '原样入 JSONB', true],
  ['jiage03', null, null, '全空（实测 0 行有值）→ 不迁', 'HIGH', '不迁', false],
  ['jiage04', null, null, '全空 → 不迁', 'HIGH', '不迁', false],
  ['jiage05', null, null, '全空 → 不迁', 'HIGH', '不迁', false],
  ['shenhe_yy', null, null, '全空（审核原因）→ 不迁', 'HIGH', '不迁', false],
  ['group_Remark', null, null, '全空（组团备注）→ 不迁', 'HIGH', '不迁', false],
  ['exhibitors001', null, null, '全空 → 不迁', 'HIGH', '不迁', false],
  ['exhibitors024_2', null, null, '全空 → 不迁', 'HIGH', '不迁', false],
  ['order_ident', null, null, '全空 → 不迁', 'HIGH', '不迁', false],
];

let n = 0;
for (const [lc, tt, tc, semantic, conf, transform, pending] of M) {
  await pool.query(
    `INSERT INTO etl.field_mapping(legacy_table, legacy_column, target_table, target_column, semantic, confidence, transform, pending_ruling)
     VALUES ('expo_exhibitors',$1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (legacy_table, legacy_column)
     DO UPDATE SET target_table=EXCLUDED.target_table, target_column=EXCLUDED.target_column,
       semantic=EXCLUDED.semantic, confidence=EXCLUDED.confidence, transform=EXCLUDED.transform,
       pending_ruling=EXCLUDED.pending_ruling`,
    [lc, tt, tc, semantic, conf, transform, pending],
  );
  n += 1;
}
console.log(`补录 ${n} 条（§B 未覆盖列，语义来自副本实测）`);

const cov = await pool.query(
  `select count(*) as 主表列数,
          count(*) filter (where m.legacy_column is not null) as 已登记,
          count(*) filter (where m.legacy_column is null) as 仍未覆盖
     from information_schema.columns c
     left join etl.field_mapping m on m.legacy_column = c.column_name
    where c.table_schema='legacy' and c.table_name='pe__expo_exhibitors'`,
);
console.log('覆盖率：', cov.rows[0]);

const sum = await pool.query(
  `select pending_ruling, count(*) from etl.field_mapping group by 1 order by 1`,
);
for (const r of sum.rows) console.log(`  待裁决=${r.pending_ruling ? '是' : '否'}  ${r.count} 列`);

await close();
