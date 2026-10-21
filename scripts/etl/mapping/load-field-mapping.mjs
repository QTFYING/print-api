/**
 * 第 2 步「语义映射」落地：把 docs/数据库表结构汇总.md §B 的编号列映射灌进 etl.field_mapping。
 * 口径来源：§B1（编号主字段）、§B2（非编号字段）与 plans/05 §6.1/§6.3 的新模型标；
 * 置信度沿用文档：HIGH=表单标签/文档明确，MEDIUM=上下文推断，UNKNOWN=仅知被写入语义未明。
 * UNKNOWN 一律 target=legacy_extra 且 pending_ruling=true（零数据丢失，确认后再归位）。
 * 用法：node scripts/etl/mapping/load-field-mapping.mjs
 */
import { pool, close } from '../lib/db.mjs';

const T = 'exhibitor';
/** [旧列, 新表, 新列, 语义, 置信度, 转换规则, 是否待裁决] */
const M = [
  ['exhibitors000', T, 'show_id', '展会届次（所有列表过滤键）', 'HIGH', 'int→uuid 需按 expo_show.id 映射', false],
  ['exhibitors002', T, 'company_name_cn', '公司名称（中文全称）；空时自动取英文名', 'HIGH', 'trim', false],
  ['exhibitors002_1', T, 'company_name_cn_abbr', '公司名称（中文简称）', 'HIGH', null, false],
  ['exhibitors003', T, 'company_name_en', '公司名称（英文全称）', 'HIGH', null, false],
  ['exhibitors003_1', T, 'company_name_en_abbr', '公司名称（英文简称）', 'HIGH', null, false],
  ['exhibitors004', T, 'province_code', '省份（存 PROVINCE_CODE，级联 bs_*）', 'HIGH', '关联 geo_dict', false],
  ['exhibitors005', T, 'address_cn', '企业地址（中文）', 'HIGH', null, false],
  ['exhibitors006', T, 'address_en', '企业地址（英文）', 'HIGH', null, false],
  ['exhibitors007', T, 'postcode', '邮编', 'HIGH', null, false],
  ['exhibitors008', T, 'website', '公司网址', 'HIGH', null, false],
  ['exhibitors009', T, 'contact_name_cn', '联系人（中文）', 'HIGH', null, false],
  ['exhibitors010', T, 'contact_name_en', '联系人（英文）', 'MEDIUM', null, false],
  ['exhibitors011', T, 'contact_title', '联系人职务', 'HIGH', null, false],
  ['exhibitors012', T, 'phone', '电话', 'HIGH', null, false],
  ['exhibitors013', T, 'fax', '传真', 'HIGH', null, false],
  ['exhibitors014', T, 'mobile', '手机（登录辅助凭据）', 'HIGH', 'PII 脱敏展示', false],
  ['exhibitors015', T, 'login_email', 'Email = 展商端登录账号', 'HIGH', 'lower/trim，归并入 member', false],
  ['exhibitors015_1', 'legacy_extra', null, '广告信息-类别（编辑页 if(1==2) 隐藏块，已停用）', 'HIGH', '原样入 JSONB', false],
  ['exhibitors015_2', 'legacy_extra', null, '广告信息-规格（已停用）', 'HIGH', '原样入 JSONB', false],
  ['exhibitors015_3', 'legacy_extra', null, '广告信息-位置（已停用）', 'HIGH', '原样入 JSONB', false],
  ['exhibitors015_4', 'legacy_extra', null, '广告信息-数量（已停用）', 'HIGH', '原样入 JSONB', false],
  ['exhibitors015_5', 'legacy_extra', null, '广告信息-广告费（financial_prompt 用它合计应收）', 'HIGH', '金额清洗后再定去留', true],
  ['exhibitors015_6', 'legacy_extra', null, '隐藏遗留字段（D 文档记"遗留联系人扩展"，或展品类别串回显）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors016', T, 'booth_type', '展台类型（光地/标准/广告）', 'HIGH', '枚举映射 BoothType', false],
  ['exhibitors016_1', T, 'booth_length_m', '展台长(m)', 'HIGH', '::numeric', false],
  ['exhibitors016_2', T, 'booth_width_m', '展台宽(m)', 'HIGH', '::numeric', false],
  ['exhibitors016_3', T, 'booth_opening_faces', '展位开口面 1~4', 'HIGH', '::int', false],
  ['exhibitors016_4', T, 'country_region', '国家/地区（存 expo_country 文本）', 'HIGH', '关联 code_dict', false],
  ['exhibitors016_5', 'legacy_extra', null, '含义不明（仅保存端写入，无表单控件）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors016_6', T, 'price_zone', '展位区域 A/B/C（价区 JGQY 2200/1700/1300）', 'HIGH', null, false],
  ['exhibitors016_a', 'legacy_extra', null, '含义不明（仅 INSERT 列清单，遗留）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors016_b', 'legacy_extra', null, '含义不明（仅 INSERT 列清单，遗留）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors017', T, 'hall_id', '展馆名（取值来自 expo_show.show008~show017_10；权限过滤键）。D 文档曾误记为"展位号"，以现行编辑页标签=展馆为准', 'HIGH', '名称→show_hall.id', false],
  ['exhibitors018', T, 'booth_no', '展位号（同届次唯一查重键；合同编号=show001-ZWH）', 'HIGH', '复合唯一 (show_id,booth_no)', false],
  ['exhibitors019', 'legacy_extra', null, '"数量…个"（隐藏，疑广告/展具数量）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors020', T, 'area_sqm', '面积㎡（=016_1×016_2 前端算）', 'HIGH', '::numeric', false],
  ['exhibitors020_1', T, 'booth_fee', '展位费（financial_prompt 应收合计用）', 'HIGH', '实测 3683/3693 为空，真值在 fenpeizw.ZW*', false],
  ['exhibitors021', T, 'category_big_id', '展品类别大类 id', 'HIGH', '→product_category', false],
  ['exhibitors022', T, 'category_small_id', '展品类别小类 id', 'HIGH', '→product_category', false],
  ['exhibitors023', T, 'profile_cn', '企业简介（中文）', 'HIGH', null, false],
  ['exhibitors024', T, 'profile_en', '企业简介（英文）', 'HIGH', null, false],
  ['exhibitors024_1', 'legacy_extra', null, '联系/沟通记录遗留（search_ex_dj 展示，编辑页已注释）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors024_3', 'legacy_extra', null, '联系/沟通记录遗留（JS wgjl 写入）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors025', 'legacy_extra', null, '联系记录（编辑页"联系内容"已注释，保存仍写）', 'MEDIUM', '评估是否并入 exhibitor_contact_log', true],
  ['exhibitors026', T, 'salesperson', '业务员', 'HIGH', null, false],
  ['exhibitors028', 'legacy_extra', null, '含义不明（无表单控件，UPDATE/INSERT 仍带）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors029', T, 'company_nature', '企业性质（内资/外资/合资/国企）', 'HIGH', '→code_dict', false],
  ['exhibitors030', T, 'company_type', '企业类型（Company_category 1~5）', 'HIGH', '→code_dict', false],
  ['exhibitors031', T, 'legal_person_name', '法人姓名', 'HIGH', null, false],
  ['exhibitors032', T, 'general_manager_name', '总经理姓名', 'HIGH', null, false],
  ['exhibitors033', T, 'registered_address', '注册地址', 'HIGH', null, false],
  ['exhibitors033_1', 'legacy_extra', null, '遗留列（仅 reg_save 老写路径）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors033_2', 'legacy_extra', null, '遗留列（仅 reg_save 老写路径）', 'UNKNOWN', '原样入 JSONB', true],
  ['exhibitors034', T, 'office_address', '办公地址', 'HIGH', null, false],
  // —— §B2 非编号字段 ——
  ['id', T, 'id', '自增主键', 'HIGH', '新模 uuid(7)，旧 id 存 legacy_ref 供回查', false],
  ['end01', T, 'stage', '流程位：申请表已提交', 'HIGH', '八位归一为 ExhibitorStage + stage_log', false],
  ['end02', T, 'stage', '申请成功', 'HIGH', '同上', false],
  ['end03', T, 'stage', '展位已分配', 'HIGH', '同上', false],
  ['end04', T, 'stage', '展位已确定', 'HIGH', '同上', false],
  ['end05', T, 'stage', '合同已生成', 'HIGH', '同上（唯一自动置位点保留）', false],
  ['end06', T, 'stage', '合同已签订', 'HIGH', '同上（财务勾选级联补置保留）', false],
  ['end07', T, 'stage', '定金支付', 'HIGH', '同上', false],
  ['end08', T, 'stage', '余款支付', 'HIGH', '同上', false],
  ['group_leader', T, 'booth_request', '展位状态 1确定/2请求更换/3取消/4审核通过（列表着色）', 'HIGH', '→BoothChangeRequest 枚举', false],
  ['iscancel', T, 'is_cancelled', '取消参展（=1 登录被拒、列表标红）', 'HIGH', '行为 1:1 复刻', false],
  ['ztbh', T, 'group_no', '组团号（三位，right((ztbh+1)+1000,3) 生成）', 'HIGH', null, false],
  ['yxzg_id', T, 'intention_hall_id', '意向展馆（→expo_exhibits_partition.id）', 'HIGH', '→show_hall', false],
  ['itma_pas', 'member', 'password_hash', '展商端登录密码（无盐 MD5，重置固定 123456）', 'HIGH', 'LEGACY_MD5 兼容校验 + 首登强制改密 → argon2id', false],
  ['itma_id', T, 'itma_ref_id', 'ITMA 侧关联 id', 'MEDIUM', null, false],
  ['exhibitors_online', T, 'record_pool', '1=在线池/被退回，0=已入后台管理池', 'HIGH', '→RecordPool 枚举', false],
  ['applicationdate', T, 'application_submitted_at', '参展申请表首次提交时间', 'HIGH', '零日期→NULL', false],
  ['bs_city', T, 'city_code', '市（与基础表 bs_city 同名易混）', 'HIGH', '实测存行政区划代码', false],
  ['bs_area', T, 'district_code', '区（同上）', 'HIGH', '实测存行政区划代码', false],
  ['fascia_cn', T, 'fascia_cn', '楣板字（中文）', 'HIGH', null, false],
  ['fascia_en', T, 'fascia_en', '楣板字（英文）', 'HIGH', null, false],
  ['payment1_date', T, 'deposit_paid_at', '定金支付日期', 'HIGH', '零日期→NULL', false],
  ['payment1_amount', T, 'deposit_paid_amount', '定金金额', 'HIGH', '千分位→numeric', false],
  ['payment2_date', T, 'balance_paid_at', '余款支付日期', 'HIGH', '零日期→NULL', false],
  ['payment2_amount', T, 'balance_paid_amount', '余款金额', 'HIGH', '千分位→numeric', false],
  ['contract_date', T, 'contract_signed_at', '合同日期', 'HIGH', '零日期→NULL', false],
  ['brand', T, 'brand', '品牌', 'HIGH', null, false],
  ['remarks', T, 'remarks', '备注/参展意向', 'HIGH', null, false],
  ['itma01', 'exhibitor_qualification', 'is_china_printing_member', '中国印刷及设备器材工业协会会员', 'HIGH', '→boolean', false],
  ['itma02', 'exhibitor_qualification', 'is_listed_company', '是否上市公司', 'HIGH', '→boolean', false],
  ['itma02_1', 'exhibitor_qualification', 'listed_country', '上市国家', 'HIGH', null, false],
  ['itma02_2', 'exhibitor_qualification', 'stock_code', '股票代码', 'HIGH', null, false],
  ['itma03', 'exhibitor_qualification', 'is_guangdong_print_member', '广东省印刷复制业协会会员', 'HIGH', '→boolean', false],
  ['itma04', 'exhibitor_qualification', 'is_wenzhou_print_member', '温州市印刷行业协会会员', 'HIGH', '→boolean', false],
  ['itma05', 'exhibitor_qualification', 'is_specialized_novel', '专精特新企业', 'HIGH', '→boolean', false],
  ['itma06', 'exhibitor_qualification', 'specialized_type', '专精特新类型 0~3', 'HIGH', null, false],
  ['itma06_1', 'exhibitor_qualification', 'specialized_level', '级别', 'HIGH', null, false],
  ['itma06_file_oname', 'exhibitor_qualification', 'cert_object_key', '证书附件（迁 OSS 私有桶）', 'HIGH', '文件资产清单化', false],
  ['email_send', 'legacy_extra', null, '邮件发送状态（现行代码在 expo_exhibitors_c 维护，主表是否也有待 dump 确认）', 'UNKNOWN', '原样入 JSONB', true],
  ['recycle', 'legacy_extra', null, '软删除标志（仅注释方案出现过，是否已建列待确认）', 'UNKNOWN', '原样入 JSONB', true],
  ['partition_id', null, null, '按小类回填分区的旧逻辑（文档标注已废弃/注释）', 'HIGH', '不迁', false],
  // —— 展位分配明细（千分位金额重灾区）——
  ['ZWZJ', 'exhibitor_booth', 'rent_amount', '展位总价', 'HIGH', "REPLACE(x,',')::numeric(12,2)，''→NULL", false],
  ['ZWDJ', 'exhibitor_booth', 'deposit_amount', '定金', 'HIGH', "REPLACE(x,',')::numeric(12,2)", false],
  ['ZWYK', 'exhibitor_booth', 'balance_amount', '余款', 'HIGH', "REPLACE(x,',')::numeric(12,2)", false],
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
console.log(`写入 etl.field_mapping ${n} 条映射（表 expo_exhibitors + fenpeizw 金额列）`);

const sum = await pool.query(
  `select confidence, pending_ruling, count(*) from etl.field_mapping group by 1,2 order by 1,2`,
);
for (const r of sum.rows)
  console.log(`  置信度=${r.confidence.padEnd(8)} 待裁决=${r.pending_ruling ? '是' : '否'}  列数=${r.count}`);

const dup = await pool.query(
  `select legacy_column, count(*) c from etl.field_mapping group by 1 having count(*)>1 limit 5`,
);
console.log(dup.rowCount ? `重复制检查：${dup.rowCount} 组（应为 0）` : '重复制检查：无重复');

await close();
