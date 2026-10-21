/**
 * ETL 统一入口：连接串只读 api/.env（走 SSH 隧道到 myserver 开发库）。
 * 铁律（AGENTS.md）：本文件永远只连 pte_platform_dev，不得出现任何生产库连接串。
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

/** 极简 .env 解析（避免为脚本再引 dotenv） */
function loadEnv() {
  const file = resolve(repoRoot, '.env');
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL 缺失：检查 api/.env');
if (/8\.148\.188\.249|printingexhibition|i3517/i.test(url)) {
  throw new Error('拒绝执行：检测到疑似甲方生产库连接串（AGENTS.md 铁律一）');
}

export const pool = new pg.Pool({ connectionString: url, max: 4 });

/** 一次跑完一个事务，失败回滚，方便反复重放 */
export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export const q = (text, params) => pool.query(text, params);

export async function close() {
  await pool.end();
}

/** 标识符白名单化：只允许字母数字下划线，杜绝把文件名当 SQL 注入 */
export function safeIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`非法标识符：${name}`);
  return `"${name.toLowerCase()}"`;
}
