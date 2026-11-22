/**
 * 命令行解析：
 * - 整行以 # 开头为注释（返回 null，便于把命令序列存成脚本回放）
 * - 双引号包裹的参数可含空格（主要是 text 内容），引号会被去掉
 * - 引号未闭合按错误处理
 */
export class ParseError extends Error {}

export function parseLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return null;

  const tokens: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    while (i < n && /\s/.test(line[i])) i++;
    if (i >= n) break;
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      if (end < 0) throw new ParseError('unterminated quote');
      tokens.push(line.slice(i + 1, end));
      i = end + 1;
    } else {
      let j = i;
      while (j < n && !/\s/.test(line[j])) j++;
      tokens.push(line.slice(i, j));
      i = j;
    }
  }
  return tokens.length === 0 ? null : tokens;
}
