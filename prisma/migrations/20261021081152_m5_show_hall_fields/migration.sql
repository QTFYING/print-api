-- DropIndex
DROP INDEX "audit_log_after_idx";

-- DropIndex
DROP INDEX "audit_log_payload_idx";

-- DropIndex
DROP INDEX "contract_legacy_extra_idx";

-- DropIndex
DROP INDEX "contract_party_b_snapshot_idx";

-- DropIndex
DROP INDEX "exhibitor_legacy_extra_idx";

-- DropIndex
DROP INDEX "exhibitor_search_keywords_gin";

-- DropIndex
DROP INDEX "exhibitor_dues_legacy_extra_idx";

-- DropIndex
DROP INDEX "exhibitor_variant_payload_idx";

-- DropIndex
DROP INDEX "order_item_legacy_extra_idx";

-- DropIndex
DROP INDEX "product_category_legacy_extra_idx";

-- DropIndex
DROP INDEX "product_item_legacy_extra_idx";

-- DropIndex
DROP INDEX "report_baseline_actual_idx";

-- DropIndex
DROP INDEX "report_baseline_diff_idx";

-- DropIndex
DROP INDEX "report_baseline_expected_idx";

-- DropIndex
DROP INDEX "show_distribution_idx";

-- DropIndex
DROP INDEX "show_legacy_extra_idx";

-- DropIndex
DROP INDEX "show_hall_show_id_hall_no_key";

-- DropIndex
DROP INDEX "site_order_legacy_extra_idx";

-- DropIndex
DROP INDEX "visitor_legacy_extra_idx";

-- DropIndex
DROP INDEX "visitor_contact_legacy_extra_idx";

-- DropIndex
DROP INDEX "visitor_registration_data_idx";

-- AlterTable
ALTER TABLE "show" ADD COLUMN     "master_plan_url" TEXT,
ADD COLUMN     "name_cn_abbr" TEXT;

-- AlterTable
ALTER TABLE "show_hall" ADD COLUMN     "areas" JSONB,
ADD COLUMN     "hall_key" TEXT,
ALTER COLUMN "hall_no" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "audit_log_after_idx" ON "audit_log" USING GIN ("after" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "audit_log_payload_idx" ON "audit_log" USING GIN ("payload" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "contract_legacy_extra_idx" ON "contract" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "contract_party_b_snapshot_idx" ON "contract" USING GIN ("party_b_snapshot" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "exhibitor_legacy_extra_idx" ON "exhibitor" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "exhibitor_search_keywords_gin" ON "exhibitor" USING GIN ("search_keywords" array_ops);

-- CreateIndex
CREATE INDEX "exhibitor_dues_legacy_extra_idx" ON "exhibitor_dues" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "exhibitor_variant_payload_idx" ON "exhibitor_variant" USING GIN ("payload" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "order_item_legacy_extra_idx" ON "order_item" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "product_category_legacy_extra_idx" ON "product_category" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "product_item_legacy_extra_idx" ON "product_item" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "report_baseline_expected_idx" ON "report_baseline" USING GIN ("expected" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "report_baseline_actual_idx" ON "report_baseline" USING GIN ("actual" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "report_baseline_diff_idx" ON "report_baseline" USING GIN ("diff" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "show_legacy_extra_idx" ON "show" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "show_distribution_idx" ON "show" USING GIN ("distribution" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "show_hall_show_id_name_cn_key" ON "show_hall"("show_id", "name_cn");

-- CreateIndex
CREATE INDEX "site_order_legacy_extra_idx" ON "site_order" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "visitor_legacy_extra_idx" ON "visitor" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "visitor_contact_legacy_extra_idx" ON "visitor_contact" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "visitor_registration_data_idx" ON "visitor_registration" USING GIN ("data" jsonb_path_ops);

