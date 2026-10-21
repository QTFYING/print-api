/**
 * MySQL DDL → PG legacy 层 DDL 转换器。
 *
 * 设计取舍（重要）：legacy 层所有列一律 text，不保留 MySQL 类型。原因——
 *   MyISAM + 裸 PHP 的历史库里，int 列存空串、date 列存 '0000-00-00'、decimal 列存 "1,234.00" 都真实存在；
 *   保留类型会让 COPY 在第 N 行炸掉且难定位。先无损落地，类型与脏数据在 transform 阶段处理并出体检报告。
 * 同时丢弃：ENGINE / CHARSET / COLLATE / COMMENT / AUTO_INCREMENT / 索引与外键（副本层不参与约束）。
 */

/** 列名合法性：只放行标识符字符，杜绝把文件名/DDL 片段当 SQL 拼接 */
function safe(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`非法标识符：${name}`);
  return `"${name.toLowerCase()}"`;
}

/** 解析单列定义行；返回 null 表示这不是列（索引/主键/约束行） */
function parseColumn(line) {
  const m = line.match(/^`([^`]+)`\s+(.+)$/);
  if (!m) return null;
  const [, name, restRaw] = m;
  const rest = restRaw.toLowerCase();
  if (/^(primary|unique|fulltext|spatial|constraint|key|index|period)\b/.test(rest)) return null;
  return {
    name,
    notNull: rest.startsWith('not null'),
    hasDefault: /\bdefault\b/.test(rest),
    wasEnum: /\benum\b|\bset\b/.test(rest),
    original: restRaw,
  };
}

/** 从一段 CREATE TABLE 文本抽出 { table, columns[] } */
export function parseMysqlTable(ddl) {
  const head = ddl.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i);
  if (!head) return null;
  const open = ddl.indexOf('(', head.index + head[0].length - 1);
  const close = ddl.lastIndexOf(')');
  const body = open >= 0 && close > open ? ddl.slice(open + 1, close) : '';
  const columns = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim().replace(/,\s*$/, '');
    if (!line) continue;
    const c = parseColumn(line);
    if (c) columns.push(c);
  }
  return { table: head[1], columns };
}

/** 生成副本层建表语句（全 text；重跑先 DROP，副本层无状态可弃） */
export function toLegacyDdl(parsed, schema = 'legacy') {
  const { table, columns } = parsed;
  if (!columns.length) return `-- ${table}：未解析到列，跳过（需人工核对 DDL 方言）\n`;
  const colDefs = columns.map((c) => `  ${safe(c.name)} text`).join(',\n');
  return [
    `DROP TABLE IF EXISTS ${schema}.${safe(table)};`,
    `CREATE TABLE ${schema}.${safe(table)} (`,
    colDefs,
    `);`,
  ].join('\n');
}

/** 从整份 .sql 里切出所有 CREATE TABLE 块 */
export function extractTables(sqlText) {
  const out = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`[^`]+`\s*\([\s\S]*?\)\s*(?:ENGINE\s*=[^;]*|DEFAULT\s+CHARSET[^;]*|;)/gi;
  let m;
  while ((m = re.exec(sqlText))) {
    const p = parseMysqlTable(m[0]);
    if (p) out.push(p);
  }
  return out;
}

/** 供 recon 与 transform 复用的脏数据探针 */
export const DIRTY_PROBES = {
  money_with_comma: `(col) => col ~ '[0-9],[0-9]'`,
  zero_date: `(col) => col IN ('0000-00-00','0000-00-00 00:00:00')`,
  empty_in_numeric: `(col) => col = ''`,
};
