/**
 * 给 schema 的指定模型追加原生索引声明（GIN / trigram）。
 * 目的：这些索引 Prisma 能表达，必须进 schema，否则 migrate dev 会把库里原生 SQL 建的索引当 drift 删掉。
 * 部分唯一索引（带 WHERE）Prisma 6.19 不支持，留在 prisma/sql/partial_unique_indexes.sql。
 * 幂等：已存在同名声明则跳过。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'prisma/schema.prisma';
const ginJsonb = (f) => `@@index([${f}(ops: raw("jsonb_path_ops"))], type: Gin)`;
const ginTrgm = (f) => `@@index([${f}(ops: raw("gin_trgm_ops"))], type: Gin)`;

const add = {
  Show: [ginJsonb('legacyExtra'), ginJsonb('distribution')],
  Exhibitor: [
    ginJsonb('legacyExtra'),
    ginTrgm('companyNameCn'),
    ginTrgm('companyNameEn'),
    ginTrgm('searchPinYin'),
  ],
  ExhibitorDues: [ginJsonb('legacyExtra')],
  Contract: [ginJsonb('legacyExtra'), ginJsonb('partyBSnapshot')],
  ProductCategory: [ginJsonb('legacyExtra')],
  OrderItem: [ginJsonb('legacyExtra')],
  SiteOrder: [ginJsonb('legacyExtra')],
  Visitor: [ginJsonb('legacyExtra')],
  VisitorContact: [ginJsonb('legacyExtra')],
  VisitorRegistration: [ginJsonb('data')],
  ExhibitorVariant: [ginJsonb('payload')],
  AuditLog: [ginJsonb('after'), ginJsonb('payload')],
  ProductItem: [ginJsonb('legacyExtra'), ginTrgm('nameCn')],
  ReportBaseline: [ginJsonb('expected'), ginJsonb('actual'), ginJsonb('diff')],
};

const src = readFileSync(path, 'utf8');
let inserted = 0;

const out = src.replace(/^model\s+(\w+)\s*\{[\s\S]*?^\}/gm, (block, name) => {
  const decls = add[name];
  if (!decls) return block;
  const missing = decls.filter((d) => !block.includes(d));
  if (!missing.length) return block;
  inserted += missing.length;
  const idx = block.lastIndexOf('\n}');
  return `${block.slice(0, idx)}\n\n  // —— PG 原生索引（Prisma 可表达部分，随迁移生成；部分唯一索引见 prisma/sql）——\n${missing
    .map((d) => `  ${d}`)
    .join('\n')}${block.slice(idx)}`;
});

writeFileSync(path, out);
console.log(`inserted ${inserted} native index declarations`);
