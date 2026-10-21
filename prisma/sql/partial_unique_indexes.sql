-- ============================================================
-- 部分唯一索引（带 WHERE）—— Prisma 6.19 无法在 schema 声明，故独立受管
-- 幂等：全部 IF NOT EXISTS，可重复执行；pnpm db:indexes:ensure 负责在每次迁移后补齐
-- 依据 plans/05 §6.2 / §6.3 / §7
-- ============================================================

-- (1) 同届次展位号唯一：根治旧系统查重/导出不带届次的 D3 漏洞
--     仅约束「已分到展位号且未软删」的行
CREATE UNIQUE INDEX IF NOT EXISTS exhibitor_show_booth_uq
  ON exhibitor (show_id, booth_no)
  WHERE booth_no IS NOT NULL AND deleted_at IS NULL;

-- (2) 同展馆内展位号唯一（活跃分配行）
CREATE UNIQUE INDEX IF NOT EXISTS exhibitor_booth_hall_no_uq
  ON exhibitor_booth (hall_id, booth_no)
  WHERE hall_id IS NOT NULL AND active = true;

-- (3) 会员一表三身份：同一外部对象只允许绑定一次
--     （手工新建、ref_id 为空的身份不受此约束）
CREATE UNIQUE INDEX IF NOT EXISTS member_identity_kind_ref_uq
  ON member_identity (member_id, kind, ref_id)
  WHERE ref_id IS NOT NULL;

-- (4) 同一时刻只允许一个 current 届次（登录默认选届不能有两个答案）
CREATE UNIQUE INDEX IF NOT EXISTS show_current_uq
  ON "show" (is_current)
  WHERE is_current = true;

-- (5) 列表主路径：默认只看未软删展商
CREATE INDEX IF NOT EXISTS exhibitor_active_list
  ON exhibitor (show_id, stage)
  WHERE deleted_at IS NULL;
