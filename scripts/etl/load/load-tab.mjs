/**
 * 第 1 步「取底」落地：把甲方离线导出的 mysqldump --tab 目录灌进 legacy 副本层。
 *
 * 用法：
 *   node scripts/etl/load/load-tab.mjs <dump目录> --db printingexhibition [--note 说明] [--backslash-escape]
 * 目录结构（mysqldump --tab 产物）：
 *   <dir>/expo_show.sql   单表建表语句
 *   <dir>/expo_show.txt   制表符分隔数据（NULL 为 \N）
 *
 * 编码前置：dump 必须以 UTF-8 交付（老库部分导出件是 GBK）。GBK 时先转码：
 *   iconv -f GBK -t UTF-8//TRANSLIT expo_show.txt > expo_show.utf8.txt
 *
 *  COPY 选项默认按「enclosed by 双引号 + 不做反斜杠转义」解析（推荐甲方这样导），
 *  如甲方用了 mysqldump 默认转义，加 --backslash-escape。
 */
import { readdirSync, readFileSync, createReadStream, existsSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { copyFrom } from '../lib/deps.mjs';
import { extractTables, toLegacyDdl } from '../lib/mysql-ddl.mjs';
import { q, withClient, close } from '../lib/db.mjs';

const argv = process.argv.slice(2);
const dir = argv[0] && !argv[0].startsWith('--') ? resolve(argv[0]) : null;
if (!dir || !existsSync(dir)) {
  console.error('用法：node scripts/etl/load/load-tab.mjs <dump目录> --db <源库名> [--note x] [--backslash-escape]');
  process.exit(2);
}
const getFlag = (name) => argv.includes(`--${name}`);
const getOpt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sourceDb = getOpt('db') ?? 'printingexhibition';
const note = getOpt('note') ?? '';
const backslashEscape = getFlag('backslash-escape');

/** COPY 选项串 */
function copyOptions() {
  const parts = [
    'FORMAT csv',
    String.raw`DELIMITER E'\t'`,
    // 注意：E'' 里 \N 不是合法转义会被吞成 "N"，必须写双反斜杠才能在 PG 侧得到 \N
    String.raw`NULL E'\\N'`,
    `QUOTE '"'`,
  ];
  if (backslashEscape) parts.push(String.raw`ESCAPE E'\\'`);
  return `WITH (${parts.join(', ')})`;
}

const files = readdirSync(dir);
const tables = files.filter((f) => extname(f) === '.sql').map((f) => basename(f, '.sql'));
console.log(`发现 ${tables.length} 张表的 DDL，开始装载到 legacy 副本层（源库 ${sourceDb}）`);

const batch = await q(
  `INSERT INTO etl.dump_batch(source_db, kind, status, note) VALUES ($1,'full_data','LOADING',$2) RETURNING id`,
  [sourceDb, note],
);
const batchId = batch.rows[0].id;

const results = [];
for (const t of tables) {
  const started = Date.now();
  try {
    const parsedList = extractTables(readFileSync(`${dir}/${t}.sql`, 'utf8'));
    if (!parsedList.length) throw new Error('未从 .sql 中解析出 CREATE TABLE');
    const parsed = parsedList.find((p) => p.table === t) ?? parsedList[0];
    const ddl = toLegacyDdl(parsed);
    await withClient(async (client) => {
      await client.query('BEGIN');
      for (const stmt of ddl.split(';').filter((s) => s.trim() && !s.trim().startsWith('--'))) {
        await client.query(stmt);
      }
      await client.query('COMMIT');
    });

    const dataFile = `${dir}/${parsed.table}.txt`;
    let loaded = 0;
    if (existsSync(dataFile)) {
      loaded = await withClient(
        (client) =>
          new Promise((res, rej) => {
            const stream = createReadStream(dataFile, { encoding: 'utf8', highWaterMark: 1 << 20 });
            const out = client.query(copyFrom(`COPY legacy.${safe(parsed.table)} FROM STDIN ${copyOptions()}`));
            out.on('error', rej);
            stream.on('error', rej);
            out.on('finish', () => res(Number(out.result?.rowCount ?? 0)));
            stream.pipe(out);
          }),
      );
    }
    const counted = await q(`SELECT count(*)::bigint AS n FROM legacy.${safe(parsed.table)}`);
    const n = Number(counted.rows[0].n);
    await q(
      `INSERT INTO etl.legacy_recon(batch_id, legacy_table, source_db, row_count, aggregates)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (batch_id, legacy_table) DO UPDATE SET row_count=EXCLUDED.row_count, snapshotted_at=now()`,
      [batchId, parsed.table, sourceDb, n, JSON.stringify({ stream_rows: loaded, ms: Date.now() - started })],
    );
    results.push({ table: parsed.table, rows: n, ok: true });
    console.log(`  OK   ${parsed.table.padEnd(42)} ${String(n).padStart(9)} 行`);
  } catch (e) {
    results.push({ table: t, ok: false, error: e.message.slice(0, 200) });
    console.log(`  FAIL ${t.padEnd(42)} ${e.message.slice(0, 140)}`);
  }
}

const okN = results.filter((r) => r.ok).length;
await q(`UPDATE etl.dump_batch SET status=$2, imported_at=now() WHERE id=$1`, [
  batchId,
  okN === results.length ? 'LOADED' : 'PARTIAL',
]);
console.log(`\n装载完成：${okN}/${results.length} 张表成功，批次 ${batchId}`);
if (okN < results.length) {
  console.log('失败明细：');
  for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.table}: ${r.error}`);
}
await close();

function safe(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`非法表名：${name}`);
  return `"${name.toLowerCase()}"`;
}
