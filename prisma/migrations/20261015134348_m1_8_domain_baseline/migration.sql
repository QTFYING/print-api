-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExhibitorStage" AS ENUM ('SUBMITTED', 'APPROVED', 'BOOTH_ASSIGNED', 'BOOTH_CONFIRMED', 'CONTRACT_GENERATED', 'CONTRACT_SIGNED', 'DEPOSIT_PAID', 'BALANCE_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BoothChangeRequest" AS ENUM ('CONFIRMED', 'REQUEST_CHANGE', 'CANCELLED', 'APPROVED');

-- CreateEnum
CREATE TYPE "BoothType" AS ENUM ('RAW_SPACE', 'STANDARD', 'ADVERTISEMENT');

-- CreateEnum
CREATE TYPE "RecordPool" AS ENUM ('ONLINE', 'MANAGED');

-- CreateEnum
CREATE TYPE "StageChangeSource" AS ENUM ('MANUAL', 'CONTRACT_GENERATED', 'FINANCE_CASCADE', 'CONTRACT_VOID', 'MIGRATION');

-- CreateEnum
CREATE TYPE "AssocUnitType" AS ENUM ('DONGGUAN_ZHONGYIN', 'BEIJING_HUAGANG', 'CHINA_PRINTING', 'GUANGDONG_PRINTING');

-- CreateEnum
CREATE TYPE "ApprovalNodeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'VOIDED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REASSIGN', 'WITHDRAW', 'VOID', 'GENERATE_SHEET');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'GENERATED', 'SIGNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('ASSOCIATION', 'TIME_LIMIT');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('BANK_TRANSFER', 'ONLINE_WECHAT', 'CASH', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "LockBlock" AS ENUM ('INFO', 'INVOICE', 'BOOTH_FEE', 'DEPOSIT', 'BALANCE', 'REFUND', 'PENALTY', 'OTHER');

-- CreateEnum
CREATE TYPE "LockStatus" AS ENUM ('LOCKED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('VAT_SPECIAL', 'VAT_GENERAL', 'RECEIPT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'VERIFIED', 'VOIDED', 'RETURNED');

-- CreateEnum
CREATE TYPE "FlowbackStatus" AS ENUM ('NOT_SENT', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TicketKind" AS ENUM ('EARLY_BIRD', 'FULL_PRICE', 'GROUP', 'INVITATION', 'STAFF');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHECKED_IN');

-- CreateEnum
CREATE TYPE "VisitorSource" AS ENUM ('LEGACY_PC', 'LEGACY_MICROSITE', 'PORTAL_PREREG', 'CIEC', 'MEMBER_SELF', 'ONSITE_SCAN');

-- CreateEnum
CREATE TYPE "ETicketStatus" AS ENUM ('ISSUED', 'USED', 'INVALID', 'LOST');

-- CreateEnum
CREATE TYPE "MemberKind" AS ENUM ('VISITOR', 'EXHIBITOR', 'STAFF');

-- CreateEnum
CREATE TYPE "PasswordAlgorithm" AS ENUM ('LEGACY_MD5', 'BCRYPT', 'ARGON2ID');

-- CreateEnum
CREATE TYPE "SmsChannel" AS ENUM ('SMS', 'VOICE', 'QRCODE');

-- CreateEnum
CREATE TYPE "SmsScene" AS ENUM ('VISITOR_REGISTER', 'EXHIBITOR_LOGIN', 'EXHIBITOR_REGISTER', 'PASSWORD_RESET', 'TICKET_CHECKIN');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'PURGED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('SOURCE_FINAL', 'MACHINE_DRAFT', 'HUMAN_REVIEWED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ContentLang" AS ENUM ('zh', 'en');

-- CreateEnum
CREATE TYPE "SnapshotType" AS ENUM ('PREVIOUS_EDITION', 'IMPORT_STAGING', 'ITMA', 'ONLINE_POOL');

-- CreateEnum
CREATE TYPE "AuditTargetKind" AS ENUM ('EXHIBITOR', 'CONTRACT', 'APPROVAL', 'PAYMENT', 'INVOICE', 'LOCK', 'ORDER', 'VISITOR', 'MEMBER', 'CONTENT', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SqlKind" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "show" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "start_on" DATE,
    "end_on" DATE,
    "venue_name" TEXT,
    "venue_address" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "distribution" JSONB,
    "legacy_extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "show_hall" (
    "id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "hall_no" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "price_zone" TEXT,
    "floor_plan_url" TEXT,
    "remark" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "show_hall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "label" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_no" TEXT NOT NULL,
    "account_name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bank_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_party" (
    "id" TEXT NOT NULL,
    "unit_type" "AssocUnitType",
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "tax_no" TEXT,
    "template_deposit" TEXT,
    "template_contract" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "organizer_party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "DiscountKind" NOT NULL,
    "unit_type" "AssocUnitType",
    "rate" DECIMAL(6,4) NOT NULL,
    "label_cn" TEXT NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor" (
    "id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "company_name_cn" TEXT,
    "company_name_cn_abbr" TEXT,
    "company_name_en" TEXT,
    "company_name_en_abbr" TEXT,
    "search_pin_yin" TEXT,
    "province_code" TEXT,
    "city_code" TEXT,
    "district_code" TEXT,
    "address_cn" TEXT,
    "address_en" TEXT,
    "postcode" TEXT,
    "website" TEXT,
    "country_region" TEXT,
    "contact_name_cn" TEXT,
    "contact_name_en" TEXT,
    "contact_title" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "mobile" TEXT,
    "login_email" TEXT,
    "booth_type" "BoothType",
    "booth_length_m" DECIMAL(8,2),
    "booth_width_m" DECIMAL(8,2),
    "booth_opening_faces" INTEGER,
    "price_zone" TEXT,
    "hall_id" TEXT,
    "intention_hall_id" TEXT,
    "booth_no" TEXT,
    "area_sqm" DECIMAL(10,2),
    "booth_fee" DECIMAL(12,2),
    "category_big_id" TEXT,
    "category_small_id" TEXT,
    "profile_cn" TEXT,
    "profile_en" TEXT,
    "salesperson" TEXT,
    "company_nature" TEXT,
    "company_type" TEXT,
    "legal_person_name" TEXT,
    "general_manager_name" TEXT,
    "registered_address" TEXT,
    "office_address" TEXT,
    "brand" TEXT,
    "fascia_cn" TEXT,
    "fascia_en" TEXT,
    "group_no" TEXT,
    "remarks" TEXT,
    "stage" "ExhibitorStage" NOT NULL DEFAULT 'SUBMITTED',
    "booth_request" "BoothChangeRequest" DEFAULT 'CONFIRMED',
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "record_pool" "RecordPool" NOT NULL DEFAULT 'ONLINE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "application_submitted_at" TIMESTAMP(3),
    "contract_signed_at" TIMESTAMP(3),
    "deposit_paid_at" TIMESTAMP(3),
    "deposit_paid_amount" DECIMAL(12,2),
    "balance_paid_at" TIMESTAMP(3),
    "balance_paid_amount" DECIMAL(12,2),
    "legacy_extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exhibitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor_stage_log" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "from_stage" "ExhibitorStage",
    "to_stage" "ExhibitorStage" NOT NULL,
    "source" "StageChangeSource" NOT NULL DEFAULT 'MANUAL',
    "actor_id" TEXT,
    "reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exhibitor_stage_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor_booth" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "hall_id" TEXT,
    "booth_no" TEXT NOT NULL,
    "rent_amount" DECIMAL(12,2),
    "deposit_amount" DECIMAL(12,2),
    "balance_amount" DECIMAL(12,2),
    "discount_rate" DECIMAL(6,4),
    "area_sqm" DECIMAL(10,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exhibitor_booth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor_dues" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "period_code" TEXT NOT NULL,
    "period_index" INTEGER NOT NULL,
    "item_label" TEXT,
    "amount_due" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_invoiced" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_on" DATE,
    "remark" TEXT,
    "legacy_extra" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exhibitor_dues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor_contact_log" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "author_id" TEXT,
    "content" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exhibitor_contact_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor_qualification" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "is_china_printing_member" BOOLEAN NOT NULL DEFAULT false,
    "is_listed_company" BOOLEAN NOT NULL DEFAULT false,
    "listed_country" TEXT,
    "listed_city" TEXT,
    "stock_code" TEXT,
    "is_guangdong_print_member" BOOLEAN NOT NULL DEFAULT false,
    "is_wenzhou_print_member" BOOLEAN NOT NULL DEFAULT false,
    "is_specialized_novel" BOOLEAN NOT NULL DEFAULT false,
    "specialized_type" INTEGER,
    "specialized_level" TEXT,
    "cert_object_key" TEXT,
    "cert_uploaded_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exhibitor_qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitor_variant" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "exhibitor_id" TEXT,
    "snapshot_type" "SnapshotType" NOT NULL,
    "source_table" TEXT NOT NULL,
    "external_ref" TEXT,
    "company_name" TEXT,
    "payload" JSONB NOT NULL,
    "merged_into_id" TEXT,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exhibitor_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "type_id" TEXT,
    "party_a_id" TEXT,
    "contract_no" TEXT NOT NULL,
    "title" TEXT,
    "pricing_rule_id" TEXT,
    "amount_total" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "party_b_snapshot" JSONB,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_on" DATE,
    "docx_object_key" TEXT,
    "pdf_object_key" TEXT,
    "legacy_extra" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_type" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_deposit_only" BOOLEAN NOT NULL DEFAULT false,
    "template_object_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contract_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_def" (
    "id" TEXT NOT NULL,
    "zdr_type" "AssocUnitType" NOT NULL,
    "sk_type" "AssocUnitType" NOT NULL,
    "level" INTEGER NOT NULL,
    "role_code" TEXT NOT NULL,
    "skip_level" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_flow_def_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instance" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "booth_id" TEXT,
    "zdr_type" "AssocUnitType" NOT NULL,
    "sk_type" "AssocUnitType" NOT NULL,
    "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "sheet_generated" BOOLEAN NOT NULL DEFAULT false,
    "sheet_object_key" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "approval_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_node" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "role_code" TEXT NOT NULL,
    "assignee_id" TEXT,
    "status" "ApprovalNodeStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_history" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "node_id" TEXT,
    "action" "ApprovalAction" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "from_status" "ApprovalNodeStatus",
    "to_status" "ApprovalNodeStatus",
    "reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_record" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "exhibitor_id" TEXT,
    "contract_id" TEXT,
    "dues_id" TEXT,
    "bank_account_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "exchange_rate" DECIMAL(10,4),
    "amount_cny" DECIMAL(12,2),
    "rate_snapshot" DATE,
    "channel" "PaymentChannel" NOT NULL DEFAULT 'BANK_TRANSFER',
    "voucher_no" TEXT,
    "paid_on" DATE,
    "received_on" DATE,
    "memo" TEXT,
    "legacy_block" TEXT,
    "entered_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivable_lock" (
    "id" TEXT NOT NULL,
    "subject_type" "AuditTargetKind" NOT NULL DEFAULT 'EXHIBITOR',
    "subject_id" TEXT NOT NULL,
    "exhibitor_id" TEXT,
    "block" "LockBlock" NOT NULL,
    "status" "LockStatus" NOT NULL DEFAULT 'UNLOCKED',
    "locked_at" TIMESTAMP(3),
    "locked_by_id" TEXT,
    "unlocked_at" TIMESTAMP(3),
    "unlocked_by_id" TEXT,
    "unlock_reason" TEXT,

    CONSTRAINT "receivable_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "invoice_no" TEXT,
    "invoice_code" TEXT,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'VAT_GENERAL',
    "title" TEXT NOT NULL,
    "tax_no" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "show_id" TEXT,
    "exhibitor_id" TEXT,
    "contract_id" TEXT,
    "payment_id" TEXT,
    "issued_on" DATE,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "file_object_key" TEXT,
    "check_note" TEXT,
    "checked_by_id" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_deposit" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT,
    "deposited_on" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "payer_name" TEXT,
    "memo" TEXT,
    "matched_payment_id" TEXT,
    "import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_deposit" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT,
    "contract_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "reason" TEXT,
    "applied_on" DATE,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "refunded_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "remark" TEXT,

    CONSTRAINT "refund_deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unknown_payment" (
    "id" TEXT NOT NULL,
    "received_on" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "payer_hint" TEXT,
    "evidence_key" TEXT,
    "claim_status" TEXT NOT NULL DEFAULT 'UNCLAIMED',
    "claimed_by_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unknown_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punishment" (
    "id" TEXT NOT NULL,
    "subject_type" "AuditTargetKind" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "amount" DECIMAL(12,2),
    "issued_on" DATE,
    "lifted_on" DATE,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_rate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_cn" TEXT,
    "rate_to_usd" DECIMAL(10,4),
    "effective_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "unit_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "partition_id" TEXT,
    "is_guozhan" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "legacy_extra" JSONB,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_template" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2),
    "spec" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fee_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "exhibitor_id" TEXT,
    "contract_id" TEXT,
    "category_id" TEXT,
    "hall_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_rate" DECIMAL(6,4),
    "is_supplement" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "legacy_extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payment" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "pay_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "method" "PaymentChannel" NOT NULL DEFAULT 'BANK_TRANSFER',
    "transaction_no" TEXT,
    "paid_at" TIMESTAMP(3),
    "operator_id" TEXT,
    "remark" TEXT,

    CONSTRAINT "order_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_order" (
    "id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "exhibitor_id" TEXT,
    "contract_id" TEXT,
    "category_id" TEXT,
    "fee_template_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "booked_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "remark" TEXT,
    "legacy_extra" JSONB,

    CONSTRAINT "site_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor" (
    "id" TEXT NOT NULL,
    "name_cn" TEXT,
    "name_en" TEXT,
    "gender" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "company_name" TEXT,
    "position_id" TEXT,
    "industry_big_id" TEXT,
    "industry_small_id" TEXT,
    "country_region" TEXT,
    "province_code" TEXT,
    "city_code" TEXT,
    "district_code" TEXT,
    "address" TEXT,
    "source" "VisitorSource" NOT NULL DEFAULT 'LEGACY_PC',
    "legacy_ref" TEXT,
    "member_id" TEXT,
    "is_merged" BOOLEAN NOT NULL DEFAULT false,
    "merged_into_id" TEXT,
    "legacy_extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_registration" (
    "id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "registration_no" TEXT NOT NULL,
    "ticket_kind" "TicketKind" NOT NULL DEFAULT 'EARLY_BIRD',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "VisitorSource" NOT NULL DEFAULT 'PORTAL_PREREG',
    "legacy_ref" TEXT,
    "member_id" TEXT,
    "approved_by_id" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "check_in_gate" TEXT,
    "flowback_status" "FlowbackStatus" NOT NULL DEFAULT 'NOT_SENT',
    "flowback_at" TIMESTAMP(3),
    "flowback_error" TEXT,
    "data" JSONB,

    CONSTRAINT "visitor_registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_visit_history" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "times" INTEGER NOT NULL DEFAULT 1,
    "first_seen" TIMESTAMP(3),
    "last_seen" TIMESTAMP(3),

    CONSTRAINT "visitor_visit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_contact" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "label" TEXT,
    "name" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "legacy_extra" JSONB,

    CONSTRAINT "visitor_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_contact_log" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "author_id" TEXT,
    "content" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_contact_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_item" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "name_cn" TEXT,
    "name_en" TEXT,
    "model" TEXT,
    "intro" TEXT,
    "image_key" TEXT,
    "category_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "legacy_extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yearbook_info" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "intro_cn" TEXT,
    "intro_en" TEXT,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yearbook_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "person_name" TEXT,
    "title" TEXT,
    "country" TEXT,
    "id_type" TEXT,
    "id_no" TEXT,
    "mobile" TEXT,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_request" (
    "id" TEXT NOT NULL,
    "exhibitor_id" TEXT NOT NULL,
    "fee_template_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(12,2),
    "spec" TEXT,
    "remark" TEXT,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_activity" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "exhibitor_id" TEXT,
    "name_cn" TEXT,
    "name_en" TEXT,
    "venue" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "expected_visitors" INTEGER,
    "content" TEXT,
    "source" TEXT NOT NULL DEFAULT 'EXPO',
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_registry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "target_view" TEXT NOT NULL,
    "allowed_columns" JSONB NOT NULL,
    "allowed_predicates" JSONB,
    "public_api" BOOLEAN NOT NULL DEFAULT false,
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL DEFAULT 'INTERNAL',
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 120,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_registry" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "registry_id" TEXT NOT NULL,

    CONSTRAINT "api_key_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "hash_algorithm" "PasswordAlgorithm" NOT NULL DEFAULT 'ARGON2ID',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "legacy_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_identity" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "kind" "MemberKind" NOT NULL,
    "ref_id" TEXT,
    "exhibitor_id" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wechat_binding" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "nickname" TEXT,
    "bound_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wechat_binding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footprint" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "footprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "namecard" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "wechat_id" TEXT,
    "qr_payload" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "namecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "e_ticket" (
    "id" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL,
    "show_id" TEXT,
    "registration_id" TEXT,
    "member_id" TEXT,
    "holder_name" TEXT,
    "holder_mobile" TEXT,
    "qr_payload" TEXT,
    "status" "ETicketStatus" NOT NULL DEFAULT 'ISSUED',
    "pdf_object_key" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "gate" TEXT,

    CONSTRAINT "e_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_request" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "title" TEXT NOT NULL,
    "tax_no" TEXT,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'VAT_GENERAL',
    "amount" DECIMAL(12,2) NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "invoice_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "invoice_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_verify_log" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "scene" "SmsScene" NOT NULL,
    "channel" "SmsChannel" NOT NULL DEFAULT 'SMS',
    "code_hash" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "ip" TEXT,
    "provider_msg_id" TEXT,

    CONSTRAINT "sms_verify_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_role" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_scope" (
    "id" TEXT NOT NULL,
    "member_id" TEXT,
    "role_id" TEXT,
    "hall_id" TEXT,
    "show_id" TEXT,
    "level" TEXT NOT NULL DEFAULT 'HALL',

    CONSTRAINT "data_scope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profile" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "employee_no" TEXT,
    "department" TEXT,
    "position" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_kind" TEXT NOT NULL DEFAULT 'STAFF',
    "action" TEXT NOT NULL,
    "target_kind" "AuditTargetKind" NOT NULL,
    "target_id" TEXT,
    "legacy_table" TEXT,
    "legacy_pk" TEXT,
    "sql_kind" "SqlKind",
    "before" JSONB,
    "after" JSONB,
    "payload" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_category" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "slug" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "lang" "ContentLang" NOT NULL DEFAULT 'zh',
    "is_label" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article" (
    "id" TEXT NOT NULL,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "cover_key" TEXT,
    "body_html" TEXT,
    "lang" "ContentLang" NOT NULL DEFAULT 'zh',
    "source_lang_id" TEXT,
    "is_top" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_online" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "seo_title" TEXT,
    "seo_keywords" TEXT,
    "legacy_ref" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translation" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "target_lang" "ContentLang" NOT NULL,
    "machine_draft" TEXT,
    "human_reviewed" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'SOURCE_FINAL',
    "llm_model" TEXT,
    "terminology_key" TEXT,
    "translated_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_registration" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "job" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "nums" TEXT,
    "certs" TEXT,
    "event_id" TEXT,
    "legacy_ref" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_account" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "legacy_hash" TEXT,
    "member_id" TEXT,
    "migrated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "bucket_kind" TEXT NOT NULL DEFAULT 'PRIVATE',
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime" TEXT,
    "size_bytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT,
    "kind" TEXT,
    "exhibitor_id" TEXT,
    "legacy_path" TEXT,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_job" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params" JSONB,
    "requester_id" TEXT,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "queue_name" TEXT NOT NULL DEFAULT 'export',
    "result_asset_id" TEXT,
    "row_count" INTEGER,
    "error" TEXT,
    "signed_until" TIMESTAMP(3),
    "purge_after" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "export_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "file_name" TEXT,
    "source_asset_id" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "queue_name" TEXT NOT NULL DEFAULT 'import',
    "params" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch_error" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_no" INTEGER,
    "column" TEXT,
    "message" TEXT NOT NULL,
    "raw_value" TEXT,

    CONSTRAINT "import_batch_error_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_dict" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "parent_code" TEXT,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "geo_dict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_dict" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label_cn" TEXT NOT NULL,
    "label_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "code_dict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_baseline" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "report_key" TEXT NOT NULL,
    "params" JSONB,
    "expected" JSONB NOT NULL,
    "actual" JSONB,
    "diff" JSONB,
    "verdict" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "long_tail_report" (
    "id" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "name_cn" TEXT,
    "source_object" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "signed_by" TEXT,
    "signed_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "long_tail_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "show_code_key" ON "show"("code");

-- CreateIndex
CREATE INDEX "show_legacy_extra_idx" ON "show" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "show_distribution_idx" ON "show" USING GIN ("distribution" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "show_hall_show_id_sort_order_idx" ON "show_hall"("show_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "show_hall_show_id_hall_no_key" ON "show_hall"("show_id", "hall_no");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rule_code_key" ON "pricing_rule"("code");

-- CreateIndex
CREATE INDEX "exhibitor_show_id_booth_no_idx" ON "exhibitor"("show_id", "booth_no");

-- CreateIndex
CREATE INDEX "exhibitor_show_id_stage_idx" ON "exhibitor"("show_id", "stage");

-- CreateIndex
CREATE INDEX "exhibitor_show_id_company_name_cn_idx" ON "exhibitor"("show_id", "company_name_cn");

-- CreateIndex
CREATE INDEX "exhibitor_login_email_idx" ON "exhibitor"("login_email");

-- CreateIndex
CREATE INDEX "exhibitor_mobile_idx" ON "exhibitor"("mobile");

-- CreateIndex
CREATE INDEX "exhibitor_legacy_extra_idx" ON "exhibitor" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "exhibitor_company_name_cn_idx" ON "exhibitor" USING GIN ("company_name_cn" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "exhibitor_company_name_en_idx" ON "exhibitor" USING GIN ("company_name_en" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "exhibitor_search_pin_yin_idx" ON "exhibitor" USING GIN ("search_pin_yin" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "exhibitor_stage_log_exhibitor_id_occurred_at_idx" ON "exhibitor_stage_log"("exhibitor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "exhibitor_booth_hall_id_booth_no_idx" ON "exhibitor_booth"("hall_id", "booth_no");

-- CreateIndex
CREATE INDEX "exhibitor_booth_exhibitor_id_idx" ON "exhibitor_booth"("exhibitor_id");

-- CreateIndex
CREATE INDEX "exhibitor_dues_exhibitor_id_idx" ON "exhibitor_dues"("exhibitor_id");

-- CreateIndex
CREATE INDEX "exhibitor_dues_legacy_extra_idx" ON "exhibitor_dues" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "exhibitor_dues_exhibitor_id_period_code_key" ON "exhibitor_dues"("exhibitor_id", "period_code");

-- CreateIndex
CREATE INDEX "exhibitor_contact_log_exhibitor_id_occurred_at_idx" ON "exhibitor_contact_log"("exhibitor_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "exhibitor_qualification_exhibitor_id_key" ON "exhibitor_qualification"("exhibitor_id");

-- CreateIndex
CREATE INDEX "exhibitor_variant_snapshot_type_company_name_idx" ON "exhibitor_variant"("snapshot_type", "company_name");

-- CreateIndex
CREATE INDEX "exhibitor_variant_merged_into_id_idx" ON "exhibitor_variant"("merged_into_id");

-- CreateIndex
CREATE INDEX "exhibitor_variant_payload_idx" ON "exhibitor_variant" USING GIN ("payload" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "contract_exhibitor_id_idx" ON "contract"("exhibitor_id");

-- CreateIndex
CREATE INDEX "contract_show_id_status_idx" ON "contract"("show_id", "status");

-- CreateIndex
CREATE INDEX "contract_legacy_extra_idx" ON "contract" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "contract_party_b_snapshot_idx" ON "contract" USING GIN ("party_b_snapshot" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "contract_show_id_contract_no_key" ON "contract"("show_id", "contract_no");

-- CreateIndex
CREATE UNIQUE INDEX "contract_type_code_key" ON "contract_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_def_zdr_type_sk_type_level_key" ON "approval_flow_def"("zdr_type", "sk_type", "level");

-- CreateIndex
CREATE INDEX "approval_instance_contract_id_idx" ON "approval_instance"("contract_id");

-- CreateIndex
CREATE INDEX "approval_instance_status_idx" ON "approval_instance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_node_instance_id_level_key" ON "approval_node"("instance_id", "level");

-- CreateIndex
CREATE INDEX "approval_history_instance_id_occurred_at_idx" ON "approval_history"("instance_id", "occurred_at");

-- CreateIndex
CREATE INDEX "payment_record_show_id_received_on_idx" ON "payment_record"("show_id", "received_on");

-- CreateIndex
CREATE INDEX "payment_record_exhibitor_id_idx" ON "payment_record"("exhibitor_id");

-- CreateIndex
CREATE INDEX "payment_record_contract_id_idx" ON "payment_record"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "receivable_lock_subject_type_subject_id_block_key" ON "receivable_lock"("subject_type", "subject_id", "block");

-- CreateIndex
CREATE INDEX "invoice_invoice_no_idx" ON "invoice"("invoice_no");

-- CreateIndex
CREATE INDEX "invoice_exhibitor_id_idx" ON "invoice"("exhibitor_id");

-- CreateIndex
CREATE INDEX "bank_deposit_deposited_on_idx" ON "bank_deposit"("deposited_on");

-- CreateIndex
CREATE INDEX "refund_deposit_exhibitor_id_idx" ON "refund_deposit"("exhibitor_id");

-- CreateIndex
CREATE INDEX "punishment_subject_type_subject_id_idx" ON "punishment"("subject_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rate_code_effective_on_key" ON "currency_rate"("code", "effective_on");

-- CreateIndex
CREATE INDEX "product_category_parent_id_level_idx" ON "product_category"("parent_id", "level");

-- CreateIndex
CREATE INDEX "product_category_legacy_extra_idx" ON "product_category" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "order_item_show_id_order_no_idx" ON "order_item"("show_id", "order_no");

-- CreateIndex
CREATE INDEX "order_item_exhibitor_id_idx" ON "order_item"("exhibitor_id");

-- CreateIndex
CREATE INDEX "order_item_legacy_extra_idx" ON "order_item" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "order_payment_order_item_id_idx" ON "order_payment"("order_item_id");

-- CreateIndex
CREATE INDEX "order_payment_pay_status_idx" ON "order_payment"("pay_status");

-- CreateIndex
CREATE INDEX "site_order_exhibitor_id_idx" ON "site_order"("exhibitor_id");

-- CreateIndex
CREATE INDEX "site_order_legacy_extra_idx" ON "site_order" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "visitor_mobile_idx" ON "visitor"("mobile");

-- CreateIndex
CREATE INDEX "visitor_email_idx" ON "visitor"("email");

-- CreateIndex
CREATE INDEX "visitor_member_id_idx" ON "visitor"("member_id");

-- CreateIndex
CREATE INDEX "visitor_legacy_extra_idx" ON "visitor" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "visitor_registration_registration_no_key" ON "visitor_registration"("registration_no");

-- CreateIndex
CREATE INDEX "visitor_registration_show_id_status_idx" ON "visitor_registration"("show_id", "status");

-- CreateIndex
CREATE INDEX "visitor_registration_flowback_status_idx" ON "visitor_registration"("flowback_status");

-- CreateIndex
CREATE INDEX "visitor_registration_data_idx" ON "visitor_registration" USING GIN ("data" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "visitor_registration_show_id_visitor_id_key" ON "visitor_registration"("show_id", "visitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_visit_history_visitor_id_show_id_key" ON "visitor_visit_history"("visitor_id", "show_id");

-- CreateIndex
CREATE INDEX "visitor_contact_visitor_id_idx" ON "visitor_contact"("visitor_id");

-- CreateIndex
CREATE INDEX "visitor_contact_legacy_extra_idx" ON "visitor_contact" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "visitor_contact_log_visitor_id_occurred_at_idx" ON "visitor_contact_log"("visitor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "product_item_exhibitor_id_idx" ON "product_item"("exhibitor_id");

-- CreateIndex
CREATE INDEX "product_item_name_cn_idx" ON "product_item"("name_cn");

-- CreateIndex
CREATE INDEX "product_item_legacy_extra_idx" ON "product_item" USING GIN ("legacy_extra" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "product_item_name_cn_trgm_gin" ON "product_item" USING GIN ("name_cn" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "yearbook_info_exhibitor_id_key" ON "yearbook_info"("exhibitor_id");

-- CreateIndex
CREATE INDEX "badge_exhibitor_id_idx" ON "badge"("exhibitor_id");

-- CreateIndex
CREATE INDEX "invitation_exhibitor_id_idx" ON "invitation"("exhibitor_id");

-- CreateIndex
CREATE INDEX "billing_request_exhibitor_id_idx" ON "billing_request"("exhibitor_id");

-- CreateIndex
CREATE INDEX "event_activity_show_id_starts_at_idx" ON "event_activity"("show_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "query_registry_code_key" ON "query_registry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_hash_key" ON "api_key"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_registry_api_key_id_registry_id_key" ON "api_key_registry"("api_key_id", "registry_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_mobile_key" ON "member"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "member_email_key" ON "member"("email");

-- CreateIndex
CREATE INDEX "member_identity_member_id_kind_ref_id_idx" ON "member_identity"("member_id", "kind", "ref_id");

-- CreateIndex
CREATE INDEX "member_identity_kind_ref_id_idx" ON "member_identity"("kind", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "wechat_binding_openid_key" ON "wechat_binding"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_member_id_target_type_target_id_key" ON "favorite"("member_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "footprint_member_id_viewed_at_idx" ON "footprint"("member_id", "viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "namecard_member_id_key" ON "namecard"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "e_ticket_serial_no_key" ON "e_ticket"("serial_no");

-- CreateIndex
CREATE INDEX "e_ticket_show_id_status_idx" ON "e_ticket"("show_id", "status");

-- CreateIndex
CREATE INDEX "invoice_request_member_id_idx" ON "invoice_request"("member_id");

-- CreateIndex
CREATE INDEX "sms_verify_log_mobile_scene_sent_at_idx" ON "sms_verify_log"("mobile", "scene", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_role_member_id_role_id_key" ON "member_role"("member_id", "role_id");

-- CreateIndex
CREATE INDEX "data_scope_member_id_idx" ON "data_scope"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profile_member_id_key" ON "staff_profile"("member_id");

-- CreateIndex
CREATE INDEX "audit_log_target_kind_target_id_occurred_at_idx" ON "audit_log"("target_kind", "target_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_occurred_at_idx" ON "audit_log"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_after_idx" ON "audit_log" USING GIN ("after" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "audit_log_payload_idx" ON "audit_log" USING GIN ("payload" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "content_category_lang_slug_key" ON "content_category"("lang", "slug");

-- CreateIndex
CREATE INDEX "article_lang_is_online_published_at_idx" ON "article"("lang", "is_online", "published_at");

-- CreateIndex
CREATE INDEX "article_category_id_idx" ON "article"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_translation_article_id_target_lang_key" ON "article_translation"("article_id", "target_lang");

-- CreateIndex
CREATE INDEX "portal_registration_show_id_kind_idx" ON "portal_registration"("show_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_account_source_external_id_key" ON "legacy_account"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_object_key_key" ON "media_asset"("object_key");

-- CreateIndex
CREATE INDEX "media_asset_kind_idx" ON "media_asset"("kind");

-- CreateIndex
CREATE INDEX "media_asset_legacy_path_idx" ON "media_asset"("legacy_path");

-- CreateIndex
CREATE INDEX "export_job_kind_status_idx" ON "export_job"("kind", "status");

-- CreateIndex
CREATE INDEX "import_batch_kind_status_idx" ON "import_batch"("kind", "status");

-- CreateIndex
CREATE INDEX "import_batch_error_batch_id_idx" ON "import_batch_error"("batch_id");

-- CreateIndex
CREATE INDEX "geo_dict_parent_code_idx" ON "geo_dict"("parent_code");

-- CreateIndex
CREATE UNIQUE INDEX "geo_dict_code_key" ON "geo_dict"("code");

-- CreateIndex
CREATE UNIQUE INDEX "code_dict_group_code_key" ON "code_dict"("group", "code");

-- CreateIndex
CREATE INDEX "report_baseline_expected_idx" ON "report_baseline" USING GIN ("expected" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "report_baseline_actual_idx" ON "report_baseline" USING GIN ("actual" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "report_baseline_diff_idx" ON "report_baseline" USING GIN ("diff" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "report_baseline_report_key_show_id_key" ON "report_baseline"("report_key", "show_id");

-- CreateIndex
CREATE UNIQUE INDEX "long_tail_report_report_key_key" ON "long_tail_report"("report_key");

-- AddForeignKey
ALTER TABLE "show_hall" ADD CONSTRAINT "show_hall_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor" ADD CONSTRAINT "exhibitor_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor" ADD CONSTRAINT "exhibitor_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "show_hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor" ADD CONSTRAINT "exhibitor_intention_hall_id_fkey" FOREIGN KEY ("intention_hall_id") REFERENCES "show_hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor" ADD CONSTRAINT "exhibitor_category_big_id_fkey" FOREIGN KEY ("category_big_id") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor" ADD CONSTRAINT "exhibitor_category_small_id_fkey" FOREIGN KEY ("category_small_id") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_stage_log" ADD CONSTRAINT "exhibitor_stage_log_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_stage_log" ADD CONSTRAINT "exhibitor_stage_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_booth" ADD CONSTRAINT "exhibitor_booth_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_booth" ADD CONSTRAINT "exhibitor_booth_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "show_hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_dues" ADD CONSTRAINT "exhibitor_dues_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_contact_log" ADD CONSTRAINT "exhibitor_contact_log_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_contact_log" ADD CONSTRAINT "exhibitor_contact_log_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_qualification" ADD CONSTRAINT "exhibitor_qualification_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_variant" ADD CONSTRAINT "exhibitor_variant_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitor_variant" ADD CONSTRAINT "exhibitor_variant_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "contract_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_party_a_id_fkey" FOREIGN KEY ("party_a_id") REFERENCES "organizer_party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instance" ADD CONSTRAINT "approval_instance_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instance" ADD CONSTRAINT "approval_instance_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "exhibitor_booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_node" ADD CONSTRAINT "approval_node_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_node" ADD CONSTRAINT "approval_node_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "approval_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_dues_id_fkey" FOREIGN KEY ("dues_id") REFERENCES "exhibitor_dues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_lock" ADD CONSTRAINT "receivable_lock_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_lock" ADD CONSTRAINT "receivable_lock_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_lock" ADD CONSTRAINT "receivable_lock_unlocked_by_id_fkey" FOREIGN KEY ("unlocked_by_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_deposit" ADD CONSTRAINT "bank_deposit_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_deposit" ADD CONSTRAINT "refund_deposit_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_deposit" ADD CONSTRAINT "refund_deposit_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "show_hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_order" ADD CONSTRAINT "site_order_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_order" ADD CONSTRAINT "site_order_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_order" ADD CONSTRAINT "site_order_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_order" ADD CONSTRAINT "site_order_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_order" ADD CONSTRAINT "site_order_fee_template_id_fkey" FOREIGN KEY ("fee_template_id") REFERENCES "fee_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_registration" ADD CONSTRAINT "visitor_registration_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_registration" ADD CONSTRAINT "visitor_registration_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visit_history" ADD CONSTRAINT "visitor_visit_history_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visit_history" ADD CONSTRAINT "visitor_visit_history_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_contact" ADD CONSTRAINT "visitor_contact_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_contact_log" ADD CONSTRAINT "visitor_contact_log_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_contact_log" ADD CONSTRAINT "visitor_contact_log_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_item" ADD CONSTRAINT "product_item_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yearbook_info" ADD CONSTRAINT "yearbook_info_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_request" ADD CONSTRAINT "billing_request_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_request" ADD CONSTRAINT "billing_request_fee_template_id_fkey" FOREIGN KEY ("fee_template_id") REFERENCES "fee_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activity" ADD CONSTRAINT "event_activity_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activity" ADD CONSTRAINT "event_activity_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_registry" ADD CONSTRAINT "api_key_registry_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_key"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_registry" ADD CONSTRAINT "api_key_registry_registry_id_fkey" FOREIGN KEY ("registry_id") REFERENCES "query_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identity" ADD CONSTRAINT "member_identity_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identity" ADD CONSTRAINT "member_identity_exhibitor_id_fkey" FOREIGN KEY ("exhibitor_id") REFERENCES "exhibitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wechat_binding" ADD CONSTRAINT "wechat_binding_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footprint" ADD CONSTRAINT "footprint_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "namecard" ADD CONSTRAINT "namecard_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_ticket" ADD CONSTRAINT "e_ticket_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "visitor_registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "e_ticket" ADD CONSTRAINT "e_ticket_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_request" ADD CONSTRAINT "invoice_request_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_request" ADD CONSTRAINT "invoice_request_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_role" ADD CONSTRAINT "member_role_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_role" ADD CONSTRAINT "member_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_scope" ADD CONSTRAINT "data_scope_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_scope" ADD CONSTRAINT "data_scope_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "show_hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_category" ADD CONSTRAINT "content_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article" ADD CONSTRAINT "article_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "content_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article" ADD CONSTRAINT "article_source_lang_id_fkey" FOREIGN KEY ("source_lang_id") REFERENCES "article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_translation" ADD CONSTRAINT "article_translation_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_result_asset_id_fkey" FOREIGN KEY ("result_asset_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_error" ADD CONSTRAINT "import_batch_error_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

