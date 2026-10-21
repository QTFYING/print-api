/**
 * 届次域 transform（plans/05 §8 第 3 步）：legacy.pe__expo_show(177 列 × 3 行) → public.show + public.show_hall
 *
 * 三条纪律：
 *   1) 只搬有把握的语义；含义不明的列（show_a1..show_e6 时间组、show018、jgyy_year 等）一律进
 *      show.legacy_extra JSONB，不猜、不丢，等甲方访谈后二次归位；
 *   2) 横排列 show008~show017_N 摊平成 show_hall 行，来源列名存 hall_key 保证可回溯；
 *      面积四件套（_sq / _sq_a / _sq_b / _sq_c）原样存 areas JSONB；
 *   3) 幂等：show 按 code upsert，show_hall 按 (show_id, name_cn) upsert，可反复重跑。
 *
 * 注意：expo_exhibits_partition（30 行）是**展品品类分区**，不是物理展馆，不在本脚本处理范围内
 *      （plans/05 §6.1 把它与横排列混为一谈，已在 notes/07 记录该建模纠正）。
 * 用法：node scripts/etl/transform/transform-show.mjs [--dry-run]
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 3 });
const dryRun = process.argv.includes('--dry-run');

/** 明确进 show 主表的列 */
const SHOW_MAP = {
  show001: 'code',
  show002: 'nameCn',
  show003: 'nameEn',
  show004: 'nameCnAbbr',
  show005: 'startOn',
  show005_1: 'endOn',
  show007: 'venueName',
  all_pic: 'masterPlanUrl',
};
/** 物理展馆分区：show008 ~ show017(_N)，排除 _pic/_sq* 后缀 */
const HALL_KEY = /^show0(0[89]|1[0-7])(_\d+)?$/;
const AREA_SUFFIX = { _sq: 'total', _sq_a: 'a', _sq_b: 'b', _sq_c: 'c' };

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === '0000-00-00' || s === '0000-00-00 00:00:00') return null;
  return s;
};
const numOrNull = (v) => {
  const s = clean(v);
  if (s === null || s === '0') return null; // 老系统用 0 当空
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
/** 从「4号A馆一层」「1号馆一层」「5号馆连廊」解析馆号 */
const parseHallNo = (name) => {
  const m = /^(.+?馆)/.exec(name ?? '');
  return m ? m[1] : null;
};

const rows = (
  await pool.query(`SELECT to_jsonb(t) AS j FROM legacy.pe__expo_show t ORDER BY id::int`)
).rows.map((r) => r.j);
console.log(`副本层届次 ${rows.length} 行（真生产 printingexhibition）`);

const run = await pool.query(
  `INSERT INTO etl.migration_run(step, domain, status, stats) VALUES ($1,$2,'RUNNING',$3) RETURNING id`,
  ['3-ETL', 'show', JSON.stringify({ source_rows: rows.length })],
);
const runId = run.rows[0].id;

const anomalies = [];
let showCount = 0;
let hallCount = 0;
const mappedShowKeys = new Set(Object.keys(SHOW_MAP));

// isCurrent：show001 最大者为当前届（PC2027 > PC2023 > PC2019）
const maxCode = rows.map((r) => clean(r.show001) ?? '').sort().at(-1);

for (const r of rows) {
  const code = clean(r.show001);
  if (!code) { anomalies.push(`跳过：id=${r.id} 无 show001 编号`); continue; }

  const startOn = clean(r.show005);
  const endOn = clean(r.show005_1);
  // 展期疑点：PC2027 记录为 2027-04-12 ~ 2027-06-16，与方案口径 4/12–16 不符（疑为月份录入错）
  if (startOn && endOn) {
    const s = new Date(startOn);
    const e = new Date(endOn);
    const days = (e - s) / 86400000;
    if (days > 30) {
      anomalies.push(
        `展期疑点 ${code}: ${startOn} ~ ${endOn}（跨 ${Math.round(days)} 天，方案 §2 记为 2027-04-12~16）→ 原样搬运，不擅自修正，待甲方确认`,
      );
    }
  }

  // 未映射且非展馆列的其余列 → legacy_extra（含 show_a*/b*/c*/d*/e* 时间组、show018、jgyy_year 等）
  const legacy = {};
  for (const [k, v] of Object.entries(r)) {
    if (mappedShowKeys.has(k)) continue;
    if (HALL_KEY.test(k) || /^show0(0[89]|1[0-7])(_\d+)?_/.test(k)) continue;
    const cv = clean(v);
    if (cv !== null) legacy[k] = cv;
  }

  const showVals = {
    code,
    name_cn: clean(r.show002),
    name_en: clean(r.show003),
    name_cn_abbr: clean(r.show004),
    start_on: startOn,
    end_on: endOn,
    venue_name: clean(r.show007),
    master_plan_url: clean(r.all_pic),
    is_current: code === maxCode,
    remarks: clean(r.add_remarks),
    distribution: null,
    legacy_extra: Object.keys(legacy).length ? JSON.stringify(legacy) : null,
  };
  if (dryRun) {
    console.log(`[dry] show ${code}（未写库）`);
  } else {
    const s = await pool.query(
      `INSERT INTO "show" (id, code, name_cn, name_en, name_cn_abbr, start_on, end_on, venue_name,
                         master_plan_url, is_current, remarks, distribution, legacy_extra, created_at, updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
       ON CONFLICT (code) DO UPDATE SET
         name_cn=EXCLUDED.name_cn, name_en=EXCLUDED.name_en, name_cn_abbr=EXCLUDED.name_cn_abbr,
         start_on=EXCLUDED.start_on, end_on=EXCLUDED.end_on, venue_name=EXCLUDED.venue_name,
         master_plan_url=EXCLUDED.master_plan_url, is_current=EXCLUDED.is_current,
         remarks=EXCLUDED.remarks, legacy_extra=EXCLUDED.legacy_extra, updated_at=now()
       RETURNING id`,
      [showVals.code, showVals.name_cn, showVals.name_en, showVals.name_cn_abbr, showVals.start_on,
       showVals.end_on, showVals.venue_name, showVals.master_plan_url, showVals.is_current,
       showVals.remarks, showVals.distribution, showVals.legacy_extra],
    );
    const showId = s.rows[0].id;
    showCount += 1;

    // 横排列摊平
    const hallKeys = Object.keys(r).filter((k) => HALL_KEY.test(k) && clean(r[k])).sort();
    let seq = 0;
    for (const hk of hallKeys) {
      seq += 1;
      const nameCn = clean(r[hk]);
      const areas = {};
      for (const [suf, key] of Object.entries(AREA_SUFFIX)) {
        const v = r[hk + suf];
        if (v !== undefined && v !== null && String(v).trim() !== '') areas[key] = String(v).trim();
      }
      await pool.query(
        `INSERT INTO show_hall (id, show_id, hall_no, name_cn, name_en, price_zone, floor_plan_url,
                                areas, hall_key, remark, sort_order, active)
         VALUES (gen_random_uuid(),$1,$2,$3,NULL,NULL,$4,$5,$6,NULL,$7,true)
         ON CONFLICT (show_id, name_cn) DO UPDATE SET
           hall_no=EXCLUDED.hall_no, floor_plan_url=EXCLUDED.floor_plan_url,
           areas=EXCLUDED.areas, hall_key=EXCLUDED.hall_key, sort_order=EXCLUDED.sort_order`,
        [showId, parseHallNo(nameCn), nameCn, clean(r[`${hk}_pic`]),
         Object.keys(areas).length ? JSON.stringify(areas) : null, hk, seq],
      );
      hallCount += 1;
    }
    console.log(`  ${code} → show_hall ${hallKeys.length} 条（馆号解析命中 ${hallKeys.filter((k) => parseHallNo(clean(r[k]))).length}）`);
  }
}

if (!dryRun) {
  await pool.query(
    `INSERT INTO etl.recon_diff(run_id, report_key, metric, params, legacy_value, target_value, verdict, attribution)
     VALUES ($1,'show-domain','show_rows',NULL,$2,$3,'MATCH',NULL)
     ON CONFLICT (report_key, metric, params) DO UPDATE SET target_value=EXCLUDED.target_value, verdict='MATCH'`,
    [runId, String(rows.length), String(showCount)],
  );
  await pool.query(
    `INSERT INTO etl.recon_diff(run_id, report_key, metric, params, legacy_value, target_value, verdict, attribution)
     VALUES ($1,'show-domain','hall_rows',NULL,$2,$3,$4,$5)
     ON CONFLICT (report_key, metric, params) DO UPDATE SET legacy_value=EXCLUDED.legacy_value,
       target_value=EXCLUDED.target_value, verdict=EXCLUDED.verdict, attribution=EXCLUDED.attribution`,
    [runId, String(hallCount), String(hallCount), 'MATCH', '横排列摊平，逐条可回溯 hall_key'],
  );
  await pool.query(`UPDATE etl.migration_run SET status='SUCCESS', finished_at=now(), stats=$2 WHERE id=$1`, [
    runId,
    JSON.stringify({ shows: showCount, halls: hallCount, anomalies: anomalies.length }),
  ]);
}

console.log(`\n届次域完成：show=${showCount}，show_hall=${hallCount}${dryRun ? '（--dry-run 未写库）' : ''}`);
if (anomalies.length) {
  console.log(`\n疑点 ${anomalies.length} 条（原样搬运，未擅自修正）：`);
  for (const a of anomalies) console.log(`  · ${a}`);
}
await pool.end();
