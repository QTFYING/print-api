-- ============================================================
-- 迁移层基础设施：legacy（生产 MySQL 的 1:1 只读副本）+ etl（过程资产）
-- 刻意放 public 之外：Prisma 只管 public，不会把这些表当 drift 删除（plans/05 §8 五步法的落地载体）
-- 铁律：legacy 里的表原样保真，不改名、不改类型、不清洗——清洗只发生在 ETL 的目标侧
-- ============================================================

CREATE SCHEMA IF NOT EXISTS legacy;
CREATE SCHEMA IF NOT EXISTS etl;

-- 取底台账：甲方 dump 的批次与范围（第 1 步「取底」出口标准）
CREATE TABLE IF NOT EXISTS etl.dump_batch (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_db     text NOT NULL,              -- printingexhibition / w_pte / expo_organizer
  kind          text NOT NULL,              -- schema_only / full_data / views / routines / files
  sha256        text,
  bytes         bigint,
  received_at   timestamptz NOT NULL DEFAULT now(),
  dumped_at     timestamptz,
  imported_at   timestamptz,
  status        text NOT NULL DEFAULT 'RECEIVED',  -- RECEIVED/LOADED/VERIFIED/REJECTED
  note          text,
  UNIQUE (source_db, kind, sha256)
);

-- 副本行数与关键聚合快照（第 3 步「ETL 对账」的左半边）
CREATE TABLE IF NOT EXISTS etl.legacy_recon (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid REFERENCES etl.dump_batch(id),
  legacy_table  text NOT NULL,
  source_db     text NOT NULL,
  row_count     bigint NOT NULL DEFAULT 0,
  aggregates    jsonb,                      -- {"sum_amount":..., "count_by_show":{...}}
  null_profile  jsonb,                      -- 关键列空值率（脏数据体检）
  dirty_report  jsonb,                      -- 千分位金额/0000-00-00/GBK 乱码 命中统计
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, legacy_table)
);

-- 五步法运行记录（每步可验收，禁止一把梭）
CREATE TABLE IF NOT EXISTS etl.migration_run (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step        text NOT NULL,                -- 1取底/2映射/3ETL/4报表对账/5灰度
  domain      text,                         -- show/exhibitor/contract/financial/order/visitor/data/member
  status      text NOT NULL DEFAULT 'RUNNING',  -- RUNNING/SUCCESS/FAILED/PARTIAL
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  stats       jsonb,
  error       text
);

-- 新旧对账差异表（第 4 步出口标准：差异归零或书面归因）
CREATE TABLE IF NOT EXISTS etl.recon_diff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid REFERENCES etl.migration_run(id),
  report_key    text NOT NULL,              -- financial_total_1..5 / summary / exhibitor_count ...
  metric        text NOT NULL,
  params        jsonb,
  legacy_value  text,
  target_value  text,
  diff_value    text,
  verdict       text NOT NULL DEFAULT 'PENDING',  -- PENDING/MATCH/ATTRIBUTED/SIGNED
  attribution   text,                       -- 差异归因说明（如 f27/f28 恒 0 缺陷修复）
  signed_by     text,
  signed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_key, metric, params)
);

-- 字段映射登记表（第 2 步「语义映射」的可执行版本；field-mapping.csv 入库）
CREATE TABLE IF NOT EXISTS etl.field_mapping (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_table  text NOT NULL,
  legacy_column text NOT NULL,
  target_table  text,
  target_column text,
  semantic      text,
  confidence    text NOT NULL DEFAULT 'HIGH',   -- HIGH/MEDIUM/UNKNOWN
  transform     text,                       -- cents_strip / gbk_to_utf8 / empty_to_null / enum_map ...
  pending_ruling boolean NOT NULL DEFAULT false, -- §11 待甲方裁决
  ruling_note  text,
  UNIQUE (legacy_table, legacy_column)
);

COMMENT ON SCHEMA legacy IS '生产 MySQL 一次性离线副本，只读；禁止任何业务写入';
COMMENT ON SCHEMA etl    IS '迁移五步法过程资产（plans/05 §8）';
