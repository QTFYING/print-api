-- 装载过程资产：视图/过程/函数/触发器 DDL 留存 + 装载错误台账
-- 放 etl schema 内（Prisma 只管 public，不会把这些当 drift 删除）

CREATE TABLE IF NOT EXISTS etl.legacy_routine_ddl (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_db     text NOT NULL,
  kind          text NOT NULL,              -- VIEW / PROCEDURE / FUNCTION / TRIGGER
  object_name   text NOT NULL,
  ddl           text NOT NULL,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  used_for      text,                       -- 后续口径还原时标注用在哪张报表
  UNIQUE (source_db, kind, object_name)
);

CREATE TABLE IF NOT EXISTS etl.load_error (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     uuid REFERENCES etl.dump_batch(id),
  legacy_table text NOT NULL,
  stmt_no      bigint,
  message      text NOT NULL,
  sample       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS load_error_batch_idx ON etl.load_error (batch_id, legacy_table);
CREATE INDEX IF NOT EXISTS legacy_routine_ddl_kind_idx ON etl.legacy_routine_ddl (source_db, kind);
