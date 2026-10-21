-- 清空开发库 schema（仅限本项目 pte_platform_dev，绝不用于甲方生产库）
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO pte_dev;
