import * as fs from 'node:fs';
import { Document } from './Document';
import { Group } from './Group';
import { ModelError } from './Shape';
import type { ShapeFactory } from './ShapeFactory';

/** 轻量 XML 节点（只覆盖 SVG 需要的子集） */
interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
}

/** 手卷 XML 解析：声明、注释、元素、属性、文本、自闭合。不依赖第三方库。 */
function parseXml(src: string): XmlElement {
  let i = 0;
  const n = src.length;

  function error(msg: string): never {
    throw new ModelError(`invalid svg: ${msg}`);
  }

  function skipMisc(): void {
    for (;;) {
      while (i < n && /\s/.test(src[i])) i++;
      if (src.startsWith('<?', i)) {
        const end = src.indexOf('?>', i);
        if (end < 0) error('unterminated <?...?>');
        i = end + 2;
      } else if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i);
        if (end < 0) error('unterminated comment');
        i = end + 3;
      } else if (src.startsWith('<!', i)) {
        const end = src.indexOf('>', i);
        if (end < 0) error('unterminated <!...>');
        i = end + 1;
      } else {
        return;
      }
    }
  }

  function parseAttrs(): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (;;) {
      while (i < n && /\s/.test(src[i])) i++;
      const c = src[i];
      if (c === '>' || c === '/' || i >= n) return attrs;
      const m = /^[^\s=/>"]+/.exec(src.slice(i));
      if (!m) error(`bad attribute near: ${src.slice(i, i + 20)}`);
      const name = m[0];
      i += name.length;
      while (i < n && /\s/.test(src[i])) i++;
      if (src[i] !== '=') {
        attrs[name] = '';
        continue;
      }
      i++;
      while (i < n && /\s/.test(src[i])) i++;
      const quote = src[i];
      if (quote !== '"' && quote !== "'") error(`attribute ${name} must be quoted`);
      const end = src.indexOf(quote, i + 1);
      if (end < 0) error(`unterminated attribute ${name}`);
      attrs[name] = decodeEntities(src.slice(i + 1, end));
      i = end + 1;
    }
  }

  function parseElement(): XmlElement {
    if (src[i] !== '<') error(`expected < at offset ${i}`);
    i++;
    const m = /^[A-Za-z_][\w:.-]*/.exec(src.slice(i));
    if (!m) error(`bad tag near: ${src.slice(i, i + 20)}`);
    const tag = m[0];
    i += tag.length;
    const attrs = parseAttrs();
    const el: XmlElement = { tag, attrs, children: [], text: '' };
    if (src.startsWith('/>', i)) {
      i += 2;
      return el;
    }
    if (src[i] !== '>') error(`expected > after <${tag}`);
    i++;
    // 内容：文本与子元素
    for (;;) {
      if (i >= n) error(`unterminated <${tag}>`);
      if (src.startsWith('</', i)) {
        const close = /^<\/([\w:.-]+)\s*>/.exec(src.slice(i));
        if (!close) error(`bad closing tag near: ${src.slice(i, i + 20)}`);
        if (close[1] !== tag) error(`mismatched closing tag </${close[1]}> for <${tag}>`);
        i += close[0].length;
        return el;
      }
      if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i);
        if (end < 0) error('unterminated comment');
        i = end + 3;
        continue;
      }
      if (src[i] === '<') {
        el.children.push(parseElement());
        continue;
      }
      const end = src.indexOf('<', i);
      el.text += decodeEntities(src.slice(i, end < 0 ? n : end));
      i = end < 0 ? n : end;
    }
  }

  skipMisc();
  const root = parseElement();
  return root;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

export interface ReadResult {
  doc: Document;
  warnings: string[];
}

/**
 * SVG 读入：文件 → Document。
 * 缺 id 的元素按 `标签名+序号` 自动补 id，警告**收集后返回**，由上层打印。
 */
export class SvgReader {
  constructor(private readonly factory: ShapeFactory) {}

  readFile(path: string): ReadResult {
    let src: string;
    try {
      src = fs.readFileSync(path, 'utf8');
    } catch {
      throw new ModelError(`cannot read file: ${path}`);
    }
    return this.readString(src);
  }

  readString(src: string): ReadResult {
    const rootEl = parseXml(src);
    if (rootEl.tag !== 'svg') {
      throw new ModelError('invalid svg: root element is not <svg>');
    }
    const width = Number(rootEl.attrs.width) || 800;
    const height = Number(rootEl.attrs.height) || 600;
    const doc = new Document(width, height);
    const warnings: string[] = [];
    const counters = new Map<string, number>();

    const autoId = (tag: string): string => {
      let seq = (counters.get(tag) ?? 0) + 1;
      let candidate = `${tag}${seq}`;
      while (doc.has(candidate)) {
        seq++;
        candidate = `${tag}${seq}`;
      }
      counters.set(tag, seq);
      return candidate;
    };

    const build = (el: XmlElement, parent: Group): void => {
      // 只认工厂注册的类型，其余标签（defs/title/style…）静默跳过
      if (!this.factory.has(el.tag) && el.tag !== 'g') return;
      let id = el.attrs.id;
      if (id === undefined || id === '') {
        id = autoId(el.tag);
        warnings.push(`warning: assigned id ${id} to unnamed <${el.tag}>`);
      }
      const shape = this.factory.load(el.tag, id, el.attrs, el.text.trim());
      if (!shape) return;
      doc.attach(shape, parent);
      if (shape instanceof Group) {
        for (const child of el.children) build(child, shape);
      }
    };

    for (const child of rootEl.children) build(child, doc.root);
    return { doc, warnings };
  }
}
