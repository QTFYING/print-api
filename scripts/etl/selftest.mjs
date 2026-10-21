/**
 * 迁移管线自检：用固定样本证明「DDL 翻译 → COPY 装载 → 零丢失 → 脏数据体检」这条链路是通的。
 *
 * 注意：这里的样本只是**工具自测件**，不是业务样例数据，跑完即删；
 * 真正的验证必须用甲方 dump 导入后的 legacy 副本层来做。
 *
 * 用法：node scripts/etl/selftest.mjs
 */
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { q, close } from './lib/db.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, '__fixtures__/tab-sample');
const SRC = 'FIXTURE';
let failed = 0;

const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}${extra ? ` · ${extra}` : ''}`);
  if (!cond) failed += 1;
};

try {
  await q(`DROP TABLE IF EXISTS legacy."expo_show"`);
  execFileSync(process.execPath, [resolve(here, 'load/load-tab.mjs'), fixture, '--db', SRC], {
    stdio: 'inherit',
  });

  const cols = await q(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='legacy' AND table_name='expo_show' ORDER BY ordinal_position`,
  );
  ok(
    'MySQL DDL 方言转换成功（9 列全部落 legacy 层）',
    cols.rowCount === 9,
    `实得 ${cols.rowCount} 列`,
  );
  ok(
    '副本层列类型统一为 text（保住 int 存空串 / date 存 0000-00-00）',
    cols.rowCount > 0 && cols.rows.every((r) => r.data_type === 'text'),
  );
  ok('主键/索引/ENGINE/COMMENT 等 MySQL 专有物被丢弃且未报错', cols.rowCount === 9);

  const cnt = await q(`SELECT count(*)::int AS n FROM legacy."expo_show"`);
  ok('行数装载正确（带引号换行未拆成两行）', cnt.rows[0].n === 2, `rows=${cnt.rows[0].n}`);

  const budget = await q(
    `SELECT budget FROM legacy."expo_show" WHERE show001='2027'`,
  );
  ok(
    '千分位金额字符串零丢失（原样 "1,234,567.00"）',
    budget.rows[0]?.budget === '1,234,567.00',
    `实得 ${JSON.stringify(budget.rows[0]?.budget)}`,
  );

  const zdt = await q(`SELECT start_date FROM legacy."expo_show" WHERE show001='2027'`);
  ok('0000-00-00 脏日期被原样保留（未报错、未被悄悄改成 NULL）', zdt.rows[0]?.start_date === '0000-00-00');

  const nullCol = await q(
    `SELECT count(*)::int AS n FROM legacy."expo_show" WHERE show008 IS NULL`,
  );
  ok('\\N 正确转成 NULL', nullCol.rows[0].n === 1);

  const remark = await q(
    `SELECT position(E'\n' in remark) AS has_nl FROM legacy."expo_show" WHERE show001='2026'`,
  );
  ok('引号内换行按 CSV 保留在同一个字段里', Number(remark.rows[0]?.has_nl ?? 0) > 0);

  const recon = await q(
    `SELECT row_count, dirty_report FROM etl.legacy_recon WHERE source_db=$1`,
    [SRC],
  );
  ok('取底台账与对账基线已写入 etl schema', recon.rowCount >= 1, `${recon.rowCount} 行`);

  execFileSync(
    process.execPath,
    [resolve(here, 'recon/legacy-baseline.mjs'), '--only', 'expo_show', '--db', SRC],
    { stdio: 'inherit' },
  );
  ok('脏数据体检脚本可跑通', true);
} finally {
  await q(`DELETE FROM etl.legacy_recon WHERE source_db=$1`, [SRC]);
  await q(`DELETE FROM etl.dump_batch WHERE source_db=$1`, [SRC]);
  await q(`DROP TABLE IF EXISTS legacy."expo_show"`);
  console.log('· 自测件已清理（legacy 层与台账不留痕）');
  await close();
}

console.log(failed === 0 ? '\nALL PASS —— 装载管线就绪，等 dump' : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
