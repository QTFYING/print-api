/**
 * 第 2 步「副本装载」：把甲方生产库的 mysqldump（标准 SQL）灌进 PG 的 legacy 副本层。
 *
 * 两阶段设计（不能再改回流式）：
 *   Phase 1 解析：一次性读入并解析出表定义与行数据，结果确定、可校验（含 Dump completed 完整性判定）；
 *   Phase 2 写库：建表 → 分批 INSERT → 台账与 DDL 留存。
 *   教训：曾在 for-await 读流循环里穿插 await 写库，导致解析结果非确定性（同一文件两次跑出 2560/2063 行，
 *   而 dry-run 稳定 5628 行）——流式解析与异步写入必须解耦。
 *
 * 副本层三条铁规：表名 legacy.<前缀>__<原表>（跨库同名表隔离）；列一律 text 原样保真；单表失败只记错误不回滚他表。
 *
 * 用法：
 *   node scripts/etl/load/load-sqldump.mjs --db w_pte --file tmp-dumps/w_pte_xxx.sql.gz --baseline tmp-baselines/w_pte.rowcount
 *   --dry-run 只解析不写库；--recreate 重灌前 DROP；--only 表名关键字（调试单表）
 */
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseInsertLine, parseCreateTable } from '../lib/mysql-values.mjs';
import { pool, close } from '../lib/db.mjs';

const argv = process.argv.slice(2);
const getOpt = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const hasFlag = (n) => argv.includes(`--${n}`);
const sourceDb = getOpt('db');
const filePath = getOpt('file');
const baselinePath = getOpt('baseline');
const onlyFilter = getOpt('only');
const dryRun = hasFlag('dry-run');
const recreate = hasFlag('recreate');
if (!sourceDb || !filePath || !existsSync(filePath)) {
  console.error('用法：--db <源库> --file <dump(.sql|.gz)> [--baseline 基线] [--dry-run] [--recreate] [--only 关键字]');
  process.exit(2);
}

const PREFIX = {
  printingexhibition: 'pe',
  w_pte: 'wpte',
  dev_ems_print: 'dev',
  print: 'prt',
  chinapri_zhdj: 'cpz',
};
const prefix = PREFIX[sourceDb];
if (!prefix) {
  console.error(`未登记源库 ${sourceDb} 的表名前缀`);
  process.exit(2);
}

const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;
const targetOf = (t) => `legacy.${qid(`${prefix}__${String(t).toLowerCase()}`)}`;
const MAX_PARAMS = 20000;

/**
 * MySQL 允许文本列存 0x00，PostgreSQL 的 text 不允许（invalid byte sequence for encoding "UTF8"）。
 * 副本层要零丢失，故把 NUL 转成可逆标记 \x00（4 字符），并在台账里记数量，transform 阶段按需还原。
 */
let nulCount = 0;
function sanitize(v) {
  if (typeof v !== 'string' || !v.includes('\0')) return v;
  nulCount += 1;
  return v.replace(/\0/g, '\\x00');
}

/** 隧道会被远端 reset（本机实测多次）：连接类错误长窗口退避重试，等脚本自动重连回来 */
async function query(sql, params, tries = 10) {
  for (let i = 1; ; i += 1) {
    try {
      return await pool.query(sql, params);
    } catch (e) {
      const connErr = /ECONNREFUSED|Connection terminated|connection.*closed|ECONNRESET|timeout/i.test(e.message);
      if (!connErr || i >= tries) throw e;
      const wait = Math.min(30000, i * 4000);
      console.log(`    · 连接中断，第 ${i} 次重试（等 ${wait / 1000}s 等隧道自愈）`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

function classifyDdl(text) {
  const v = text.match(/\bVIEW\s+`([^`]+)`\s+AS\b/i);
  if (v) return { kind: 'VIEW', name: v[1] };
  const t = text.match(/\bTRIGGER\s+`?([^`\s(]+)`?\s+(BEFORE|AFTER|INSTEAD)\b/i);
  if (t) return { kind: 'TRIGGER', name: t[1] };
  const p = text.match(/CREATE (?:DEFINER=\S+ )?PROCEDURE `([^`]+)`/i);
  if (p) return { kind: 'PROCEDURE', name: p[1] };
  const f = text.match(/CREATE (?:DEFINER=\S+ )?FUNCTION `([^`]+)`/i);
  if (f) return { kind: 'FUNCTION', name: f[1] };
  return null;
}

/* ============================ Phase 1：解析 ============================ */
const raw = readFileSync(filePath);
const text = (filePath.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8'));
const lines = text.split('\n');

if (!lines.some((l) => l.startsWith('-- Dump completed'))) {
  console.error('装载中止：dump 缺少 "-- Dump completed" 结束标记，文件不完整（拒绝装载残缺数据）');
  process.exit(4);
}

const order = [];                        // 表出现顺序
const defs = new Map();                  // table -> columns
const rowStore = new Map();              // table -> rows[]
const ddlSeen = new Map();
let buf = [];
let delim = ';';
let ddlBuf = [];
let unparsedInsert = 0;

for (const lineRaw of lines) {
  const line = lineRaw.endsWith('\r') ? lineRaw.slice(0, -1) : lineRaw;

  if (line.startsWith('CREATE TABLE `')) {
    buf = [line];
    continue;
  }
  if (buf.length) {
    buf.push(line);
    if (/^\) ENGINE=/.test(line) || line === ';') {
      const parsed = parseCreateTable(buf.join('\n'));
      buf = [];
      if (parsed && parsed.columns.length) {
        defs.set(parsed.table, parsed.columns);
        if (!rowStore.has(parsed.table)) rowStore.set(parsed.table, []);
        order.push(parsed.table);
      } else if (parsed) {
        console.log(`  ? ${parsed.table} 未解析到列，跳过`);
      }
    }
    continue;
  }

  if (line.startsWith('INSERT INTO ')) {
    const r = parseInsertLine(line);
    if (!r) { unparsedInsert += 1; continue; }
    if (!rowStore.has(r.table)) {
      rowStore.set(r.table, []);
      order.push(r.table);
    }
    const bucket = rowStore.get(r.table);
    for (const row of r.rows) bucket.push(row);
    continue;
  }

  if (/^DELIMITER\b/.test(line)) {
    if (ddlBuf.length) {
      const o = classifyDdl(ddlBuf.join('\n'));
      if (o && (!ddlSeen.has(`${o.kind}|${o.name}`) || ddlBuf.join('\n').length > ddlSeen.get(`${o.kind}|${o.name}`).ddl.length))
        ddlSeen.set(`${o.kind}|${o.name}`, { ...o, ddl: ddlBuf.join('\n') });
      ddlBuf = [];
    }
    delim = line.replace(/^DELIMITER\s+/, '').trim() || ';';
    continue;
  }

  const looksDdl =
    /^\/\*!5\d+/.test(line) || /^CREATE (DEFINER|ALGORITHM|SQL SECURITY|PROCEDURE|FUNCTION|TRIGGER)/.test(line);
  if (looksDdl || ddlBuf.length) {
    ddlBuf.push(line);
    if (line.endsWith(delim) || line.endsWith('*/;')) {
      const o = classifyDdl(ddlBuf.join('\n'));
      if (o) {
        const key = `${o.kind}|${o.name}`;
        const joined = ddlBuf.join('\n');
        if (!ddlSeen.has(key) || joined.length > ddlSeen.get(key).ddl.length)
          ddlSeen.set(key, { ...o, ddl: joined });
      }
      ddlBuf = [];
    }
    continue;
  }
}
if (ddlBuf.length) {
  const o = classifyDdl(ddlBuf.join('\n'));
  if (o) ddlSeen.set(`${o.kind}|${o.name}`, { ...o, ddl: ddlBuf.join('\n') });
}

const ddlObjects = [...ddlSeen.values()];
const tablesAll = order.filter((t) => rowStore.has(t));
const totalRows = tablesAll.reduce((s, t) => s + rowStore.get(t).length, 0);
console.log(
  `\n[Phase1 解析] ${sourceDb}：${tablesAll.length} 张表 / ${totalRows} 行 / DDL 对象 ${ddlObjects.length}` +
    (unparsedInsert ? ` / 未能解析的 INSERT 行 ${unparsedInsert}` : ''),
);

if (dryRun) {
  await reportBaseline(tablesAll, (t) => rowStore.get(t).length);
  console.log('（--dry-run：未写库）');
  await close();
  process.exit(0);
}

/* ============================ Phase 2：写库 ============================ */
const batchRes = await query(
  `INSERT INTO etl.dump_batch(source_db, kind, status, note) VALUES ($1,'full_data','LOADING',$2) RETURNING id`,
  [sourceDb, `load-sqldump ${new Date().toISOString()}`],
);
const batchId = batchRes.rows[0].id;

/** 续跑支持：已落库且行数与解析一致的表直接跳过（隧道反复断，循环跑到收敛即可） */
const reconRes = await query(`SELECT legacy_table, row_count FROM etl.legacy_recon WHERE source_db=$1`, [sourceDb]);
const doneMap = new Map(reconRes.rows.map((r) => [r.legacy_table, Number(r.row_count)]));
let skipped = 0;

let okTables = 0;
let failTables = 0;
let writtenRows = 0;

for (const t of tablesAll) {
  if (onlyFilter && !t.includes(onlyFilter)) continue;
  const columns = defs.get(t);
  const rows = rowStore.get(t);
  // 台账里已核对过且行数一致 → 跳过；其余一律先 DROP 再建（避免半截表被追加成重复）
  if (doneMap.get(t) === rows.length) {
    skipped += 1;
    continue;
  }
  if (!columns) {
    failTables += 1;
    await query(
      `INSERT INTO etl.load_error(batch_id, legacy_table, message) VALUES ($1,$2,$3)`,
      [batchId, t, 'dump 中无 CREATE TABLE 定义，只有 INSERT（需人工核对）'],
    );
    console.log(`  ! ${t} 缺表定义，跳过`);
    continue;
  }
  const tgt = targetOf(t);
  const nulBefore = nulCount;
  try {
    await query(`CREATE SCHEMA IF NOT EXISTS legacy`);
    await query(`DROP TABLE IF EXISTS ${tgt} CASCADE`);
    await query(`CREATE TABLE IF NOT EXISTS ${tgt} (\n${columns.map((c) => `  ${qid(c)} text`).join(',\n')}\n)`);
  } catch (e) {
    failTables += 1;
    console.log(`  ! ${t} 建表失败：${e.message.slice(0, 140)}`);
    continue;
  }

  const per = Math.max(1, Math.floor(MAX_PARAMS / columns.length));
  let tableWritten = 0;
  try {
    const colsSql = columns.map((c) => qid(c)).join(',');
    for (let i = 0; i < rows.length; i += per) {
      const chunk = rows.slice(i, i + per);
      const params = [];
      const tuples = [];
      for (const r of chunk) {
        const ph = [];
        for (let c = 0; c < columns.length; c += 1) {
          params.push(sanitize(r[c] ?? null));
          ph.push(`$${params.length}`);
        }
        tuples.push(`(${ph.join(',')})`);
      }
      await query(`INSERT INTO ${tgt} (${colsSql}) VALUES ${tuples.join(',')}`, params);
      tableWritten += chunk.length;
    }
  } catch (e) {
    failTables += 1;
    await query(
      `INSERT INTO etl.load_error(batch_id, legacy_table, message, sample) VALUES ($1,$2,$3,$4)`,
      [batchId, t, e.message.slice(0, 400), JSON.stringify(rows[tableWritten] ?? []).slice(0, 300)],
    ).catch(() => {});
    console.log(`  ! ${t} 写入失败（已写 ${tableWritten}/${rows.length}）：${e.message.slice(0, 140)}`);
    continue;
  }

  const cnt = await pool.query(`SELECT count(*)::bigint n FROM ${tgt}`);
  const n = Number(cnt.rows[0].n);
  await query(
    `INSERT INTO etl.legacy_recon(batch_id, legacy_table, source_db, row_count, aggregates)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (batch_id, legacy_table)
     DO UPDATE SET row_count=EXCLUDED.row_count, aggregates=EXCLUDED.aggregates, snapshotted_at=now()`,
    [batchId, t, sourceDb, n, JSON.stringify({ cols: columns.length, parsed: rows.length, nul_replaced: nulCount - nulBefore })],
  );
  okTables += 1;
  writtenRows += n;
  const flag = n === rows.length ? 'OK ' : 'DIFF';
  console.log(`  ${flag} ${t.padEnd(42)} 解析 ${rows.length} → 落库 ${n}`);
}

for (const o of ddlObjects) {
  await pool
    .query(
      `INSERT INTO etl.legacy_routine_ddl(source_db, kind, object_name, ddl) VALUES ($1,$2,$3,$4)
       ON CONFLICT (source_db, kind, object_name) DO UPDATE SET ddl=EXCLUDED.ddl`,
      [sourceDb, o.kind, o.name, o.ddl],
    )
    .catch(() => {});
}

await query(`UPDATE etl.dump_batch SET status=$2, imported_at=now() WHERE id=$1`, [
  batchId,
  failTables === 0 ? 'LOADED' : 'PARTIAL',
]);
console.log(
  `\n[Phase2 写库] 成功 ${okTables} 表 / 失败 ${failTables} 表 / 跳过已完成 ${skipped} 表，落库合计 ${writtenRows} 行，批次 ${batchId}`,
);
await reportBaseline(tablesAll, async (t) => {
  const c = await pool.query(`SELECT count(*)::bigint n FROM ${targetOf(t)}`).catch(() => null);
  return c ? Number(c.rows[0].n) : -1;
});

const byKind = {};
for (const o of ddlObjects) byKind[o.kind] = (byKind[o.kind] ?? 0) + 1;
if (Object.keys(byKind).length) console.log('DDL 对象分布：', byKind);

await close();
process.exit(failTables === 0 ? 0 : 3);

/** 与生产 COUNT(*) 基线逐表对账 */
async function reportBaseline(tables, rowCounter) {
  if (!baselinePath || !existsSync(baselinePath)) return;
  const base = new Map();
  for (const l of readFileSync(baselinePath, 'utf8').split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i > 0) base.set(l.slice(0, i).trim(), Number(l.slice(i + 1)));
  }
  const diffs = [];
  for (const t of tables) {
    const got = await rowCounter(t);
    const b = base.get(t);
    if (b === undefined) diffs.push(`  + dump 有、基线无：${t}`);
    else if (b !== got) diffs.push(`  ! ${t} 实得=${got} 基线=${b} 差=${got - b}`);
  }
  for (const [t] of base) if (!tables.includes(t)) diffs.push(`  - 基线有、dump 无：${t}`);
  console.log(diffs.length ? `\n对账差异 ${diffs.length} 处：` : '\n对账：逐表与生产 COUNT(*) 基线完全一致 ✔');
  for (const d of diffs.slice(0, 30)) console.log(d);
}
