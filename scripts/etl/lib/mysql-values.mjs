/**
 * MySQL dump 的 VALUES 元组解析器。
 * 覆盖 mysqldump 默认转义（ESCAPED BY '\\'）与 --hex-blob 产物：
 *   NULL / '字符串（含 \' \" \\ \n \r \t \0 \Z 与八进制 \xxx）' / 0x十六进制BLOB / 裸数字与日期字面量
 * 副本层所有列都是 text，因此：数字与日期按原样文本保留，NULL 转 null，BLOB 转 0x... 十六进制文本（不丢字节）。
 */

const ESC = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a', '\\': '\\', "'": "'", '"': '"' };

/** 从 s[i]（应为 '\'' 或 '"'）开始读一个引号字面量，返回 [值, 新下标] */
function readQuoted(s, i) {
  const quote = s[i++];
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      const nx = s[i + 1];
      if (nx in ESC) { out += ESC[nx]; i += 2; continue; }
      if (nx >= '0' && nx <= '7') {           // 八进制转义（\040 等）
        let oct = '';
        let j = i + 1;
        while (j < s.length && oct.length < 3 && s[j] >= '0' && s[j] <= '7') { oct += s[j]; j += 1; }
        out += String.fromCharCode(parseInt(oct, 8));
        i = j;
        continue;
      }
      out += nx; i += 2; continue;            // 未知转义：按字面保留
    }
    if (ch === quote) {
      if (s[i + 1] === quote) { out += quote; i += 2; continue; }  // '' 转义
      return [out, i + 1];
    }
    out += ch; i += 1;
  }
  throw new Error(`未闭合的字符串字面量（位置 ${i}）`);
}

/** 解析一行 `INSERT INTO \`t\` VALUES (...),(...);` → { table, rows: value[][] } */
export function parseInsertLine(line) {
  const m = line.match(/^INSERT INTO `([^`]+)` VALUES /);
  if (!m) return null;
  const table = m[1];
  let i = m[0].length;
  const rows = [];
  let cur = null;

  while (i < line.length) {
    const ch = line[i];
    if (ch === '(') { cur = []; i += 1; continue; }
    if (ch === ')') { if (cur) rows.push(cur); cur = null; i += 1; continue; }
    if (ch === ',') { i += 1; continue; }
    if (cur === null) { i += 1; continue; }   // 元组之间的空白/分号

    if (ch === "'" || ch === '"') {
      const [v, ni] = readQuoted(line, i);
      cur.push(v); i = ni; continue;
    }
    if (ch === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {   // 十六进制 BLOB
      let j = i + 2;
      while (j < line.length && /[0-9a-fA-F]/.test(line[j])) j += 1;
      cur.push(line.slice(i, j).toUpperCase());                          // 原样 0X… 保留
      i = j; continue;
    }
    // 裸字面量：NULL / 数字 / 日期（mysqldump 默认不含未加引号的日期，但保险起见按字符类扫）
    let j = i;
    while (j < line.length && !",)'\"".includes(line[j])) j += 1;
    const raw = line.slice(i, j).trim();
    cur.push(/^NULL$/i.test(raw) ? null : raw);
    i = j;
  }
  return { table, rows };
}

/** 从 CREATE TABLE 块解析列名（副本层只需要列名与顺序） */
export function parseCreateTable(block) {
  const m = block.match(/^CREATE TABLE `([^`]+)`/);
  if (!m) return null;
  const cols = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim().replace(/,$/, '');
    const cm = line.match(/^`([^`]+)`\s+\w/);
    if (cm) cols.push(cm[1]);
  }
  return { table: m[1], columns: cols };
}
