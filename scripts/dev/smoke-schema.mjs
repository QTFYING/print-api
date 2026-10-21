/**
 * M1 schema 冒烟：验证 8 域模型可用 + §6.3 D3 漏洞真的被根治。
 * 断言三件事：
 *  1) 同届次内展位号重复 → 必须被部分唯一索引挡住；
 *  2) 跨届次用同一展位号 → 必须允许（旧系统不带届次查重是历史故障源）；
 *  3) 存疑列 legacy_extra 可用 @> 走 GIN 检索（零数据丢失验收口径）。
 * 跑完自动清理，只在开发库执行：node scripts/dev/smoke-schema.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let failed = 0;

const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}${extra ? ' · ' + extra : ''}`);
  if (!cond) failed += 1;
};

const code = `SMOKE-${Date.now()}`;
/** 按外键依赖倒序清理：Prisma 生成的是 RESTRICT 外键（MyISAM 无约束的反面），顺序错就删不掉 */
async function cleanup() {
  const sweep = async (label, fn) => {
    try {
      const r = await fn();
      if (r && r.count) console.log(`  · 清理 ${label} ${r.count} 行`);
    } catch (e) {
      console.log(`  ! 清理 ${label} 失败: ${e.message.slice(0, 80)}`);
    }
  };
  await sweep('audit_log', () => prisma.auditLog.deleteMany({}));
  await sweep('data_scope', () => prisma.dataScope.deleteMany({}));
  await sweep('member_identity', () => prisma.memberIdentity.deleteMany({}));
  await sweep('receivable_lock', () => prisma.receivableLock.deleteMany({}));
  await sweep('approval_flow_def', () => prisma.approvalFlowDef.deleteMany({}));
  await sweep('payment_record', () => prisma.paymentRecord.deleteMany({}));
  await sweep('exhibitor_stage_log', () => prisma.exhibitorStageLog.deleteMany({}));
  await sweep('exhibitor', () =>
    prisma.exhibitor.deleteMany({ where: { show: { code: { startsWith: 'SMOKE-' } } } }),
  );
  await sweep('show_hall', () => prisma.showHall.deleteMany({}));
  await sweep('show', () => prisma.show.deleteMany({ where: { code: { startsWith: 'SMOKE-' } } }));
  await sweep('member', () =>
    prisma.member.deleteMany({ where: { email: { startsWith: 'SMOKE-' } } }),
  );
}

try {
  const showA = await prisma.show.create({
    data: { code: `${code}-A`, nameCn: '冒烟届次A', startOn: new Date('2027-04-12') },
  });
  const showB = await prisma.show.create({ data: { code: `${code}-B`, nameCn: '冒烟届次B' } });

  const hallA = await prisma.showHall.create({
    data: { showId: showA.id, hallNo: 'A1', nameCn: 'A馆', priceZone: 'A' },
  });

  const base = {
    hallId: hallA.id,
    boothNo: '1A01',
    companyNameCn: '冒烟印刷有限公司',
    legacyExtra: { exhibitors028: '未知列原样保', exhibitors019: '3' },
  };
  await prisma.exhibitor.create({ data: { showId: showA.id, ...base } });

  // 1) 同届次同展位号 → 期望被拒
  let dupRejected = false;
  try {
    await prisma.exhibitor.create({ data: { showId: showA.id, ...base, companyNameCn: '重复展商' } });
  } catch (e) {
    dupRejected = e.code === 'P2002' || String(e.message).includes('exhibitor_show_booth_uq');
  }
  ok('同届次展位号重复被部分唯一索引挡住', dupRejected);

  // 2) 跨届次同展位号 → 期望放行
  let crossShowOk = true;
  let crossExhibitor = null;
  try {
    crossExhibitor = await prisma.exhibitor.create({
      data: { showId: showB.id, boothNo: '1A01', companyNameCn: '跨届展商' },
    });
  } catch (e) {
    crossShowOk = false;
    console.log('   ↳ 意外错误:', e.message.slice(0, 120));
  }
  ok(
    '跨届次复用同一展位号被允许（D3 根治）',
    crossShowOk && crossExhibitor?.boothNo === '1A01',
    crossExhibitor ? `落库届次=${crossExhibitor.showId.slice(0, 8)}…` : '',
  );

  // 状态机显式化：跃迁必须记 log
  await prisma.exhibitor.update({
    where: { id: (await prisma.exhibitor.findFirst({ where: { showId: showA.id } })).id },
    data: { stage: 'BOOTH_ASSIGNED' },
  });
  const withLog = await prisma.exhibitor.findFirst({ where: { showId: showA.id } });
  await prisma.exhibitorStageLog.create({
    data: { exhibitorId: withLog.id, toStage: 'BOOTH_ASSIGNED', source: 'MIGRATION', reason: '冒烟' },
  });
  ok('展商状态机 + 跃迁日志可写', (await prisma.exhibitorStageLog.count()) === 1);

  // 3) 存疑列 JSONB @> 检索（GIN 支撑）
  const hits = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM exhibitor
    WHERE legacy_extra @> '{"exhibitors028": "未知列原样保"}'::jsonb
  `;
  ok('legacy_extra JSONB @> 检索命中存疑列', Number(hits[0].n) === 1, `hits=${hits[0].n}`);

  // 财务：金额 NUMERIC + 币种/汇率快照
  const payment = await prisma.paymentRecord.create({
    data: {
      showId: showA.id,
      amount: '1234567.89',
      currency: 'USD',
      exchangeRate: '7.1234',
      amountCny: '8794321.12',
      rateSnapshot: new Date('2027-03-01'),
    },
  });
  ok('财务流水支持币种+汇率快照（v2.0 补缺口）', payment.currency === 'USD');

  // 审批链 16 组合配置化
  await prisma.approvalFlowDef.createMany({
    data: [
      { zdrType: 'DONGGUAN_ZHONGYIN', skType: 'BEIJING_HUAGANG', level: 1, roleCode: 'HT_MANAGER' },
      { zdrType: 'DONGGUAN_ZHONGYIN', skType: 'BEIJING_HUAGANG', level: 2, roleCode: 'DEPUTY_GM' },
    ],
  });
  ok('审批流定义可按 (制单,收款,级次) 配置', (await prisma.approvalFlowDef.count()) === 2);

  // 区块锁：同主体同区块只能有一行（锁状态可翻转，不留双份）
  await prisma.receivableLock.create({
    data: { subjectId: withLog.id, exhibitorId: withLog.id, block: 'DEPOSIT', status: 'LOCKED' },
  });
  let lockDup = false;
  try {
    await prisma.receivableLock.create({ data: { subjectId: withLog.id, block: 'DEPOSIT' } });
  } catch {
    lockDup = true;
  }
  ok('财务区块锁唯一约束生效（8 锁显式化）', lockDup);

  // 会员一表三身份 + 展馆数据权限
  const member = await prisma.member.create({
    data: {
      email: `${code}@smoke.local`,
      displayName: '冒烟员工',
      hashAlgorithm: 'ARGON2ID',
      identities: { create: [{ kind: 'STAFF' }] },
      dataScopes: { create: [{ hallId: hallA.id, level: 'HALL' }] },
    },
  });
  const loaded = await prisma.member.findUnique({
    where: { id: member.id },
    include: { identities: true, dataScopes: true },
  });
  ok('会员三身份 + 届次×展馆数据权限可查', loaded.identities.length === 1 && loaded.dataScopes.length === 1);

  // 审计流水（切换日回补重放依赖）
  await prisma.auditLog.create({
    data: {
      actorId: member.id,
      action: 'UPDATE',
      targetKind: 'EXHIBITOR',
      targetId: withLog.id,
      legacyTable: 'expo_exhibitors',
      legacyPk: '9001',
      sqlKind: 'UPDATE',
      after: { booth_no: '1A01' },
    },
  });
  const replayable = await prisma.auditLog.count({ where: { legacyTable: 'expo_exhibitors' } });
  ok('审计带 legacy_table/pk，支持冻结窗回补重放', replayable === 1);
} finally {
  await cleanup();
  await prisma.$disconnect();
  console.log('· 冒烟数据已清理');
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
