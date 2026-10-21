-- 迁移 0：扩展先行（trigram 索引依赖 pg_trgm，必须早于建表索引）
-- 中文分词 zhparser/pg_jieba 属待裁决项 plans/05 §11-9，支持后另起迁移叠加
CREATE EXTENSION IF NOT EXISTS pg_trgm;
