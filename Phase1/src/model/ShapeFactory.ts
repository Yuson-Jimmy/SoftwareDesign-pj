import { Group } from './Group';
import { ModelError, parseNum, Shape } from './Shape';
import { Circle } from './shapes/Circle';
import { Ellipse } from './shapes/Ellipse';
import { Line } from './shapes/Line';
import { Rect } from './shapes/Rect';
import { Text } from './shapes/Text';

/** 由已解析的字符串参数构造图形；参数个数/非法数字在此校验 */
type Creator = (id: string, args: string[]) => Shape;

/** 由 SVG 属性表还原图形（read 用）；attrs 为原始字符串属性表，text 为元素文本 */
type Loader = (id: string, attrs: Record<string, string>, text: string) => Shape;

/**
 * 图形工厂：类型名 → 构造器。
 * 全系统仅两处按名字分派之一（另一处是 CommandRegistry），
 * 后续插件化阶段由 ShapeProvider 注册取代内核写死。
 */
export class ShapeFactory {
  private readonly creators = new Map<string, Creator>();
  private readonly loaders = new Map<string, Loader>();

  register(type: string, creator: Creator, loader?: Loader): void {
    this.creators.set(type, creator);
    if (loader) this.loaders.set(type, loader);
  }

  has(type: string): boolean {
    return this.creators.has(type);
  }

  create(type: string, id: string, args: string[]): Shape {
    const creator = this.creators.get(type);
    if (!creator) {
      throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return creator(id, args);
  }

  /** 从 SVG 属性还原；未注册的标签返回 null（读入时跳过，如 <defs>） */
  load(tag: string, id: string, attrs: Record<string, string>, text: string): Shape | null {
    const loader = this.loaders.get(tag);
    return loader ? loader(id, attrs, text) : null;
  }

  types(): string[] {
    return [...this.creators.keys()];
  }
}

function need(args: string[], min: number, max: number, usage: string): void {
  if (args.length < min || args.length > max) {
    throw new ModelError(`invalid arguments, usage: ${usage}`);
  }
}

/** 读入用：属性缺失时按 0 兜底（外部 SVG 可能缺几何属性） */
function numAttr(attrs: Record<string, string>, key: string): number {
  const raw = attrs[key];
  if (raw === undefined || raw.trim() === '') return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : n;
}

function applyStyle(shape: Shape, attrs: Record<string, string>): void {
  if (attrs.fill !== undefined) shape.fill = attrs.fill;
  if (attrs.stroke !== undefined) shape.stroke = attrs.stroke;
  if (attrs['stroke-width'] !== undefined) shape.strokeWidth = attrs['stroke-width'];
}

/** 内核默认工厂：内置 rect / circle / ellipse / line / text / g 六种类型 */
export function createDefaultFactory(): ShapeFactory {
  const f = new ShapeFactory();

  f.register(
    'rect',
    (id, a) => {
      need(a, 4, 5, 'create rect <id> <x> <y> <w> <h> [fill]');
      const r = new Rect(id, parseNum(a[0], 'x'), parseNum(a[1], 'y'), parseNum(a[2], 'w'), parseNum(a[3], 'h'));
      if (a[4] !== undefined) r.fill = a[4];
      return r;
    },
    (id, attrs) => {
      const r = new Rect(id, numAttr(attrs, 'x'), numAttr(attrs, 'y'), numAttr(attrs, 'width'), numAttr(attrs, 'height'));
      applyStyle(r, attrs);
      return r;
    },
  );

  f.register(
    'circle',
    (id, a) => {
      need(a, 3, 4, 'create circle <id> <cx> <cy> <r> [fill]');
      const c = new Circle(id, parseNum(a[0], 'cx'), parseNum(a[1], 'cy'), parseNum(a[2], 'r'));
      if (a[3] !== undefined) c.fill = a[3];
      return c;
    },
    (id, attrs) => {
      const c = new Circle(id, numAttr(attrs, 'cx'), numAttr(attrs, 'cy'), numAttr(attrs, 'r'));
      applyStyle(c, attrs);
      return c;
    },
  );

  f.register(
    'ellipse',
    (id, a) => {
      need(a, 4, 5, 'create ellipse <id> <cx> <cy> <rx> <ry> [fill]');
      const e = new Ellipse(id, parseNum(a[0], 'cx'), parseNum(a[1], 'cy'), parseNum(a[2], 'rx'), parseNum(a[3], 'ry'));
      if (a[4] !== undefined) e.fill = a[4];
      return e;
    },
    (id, attrs) => {
      const e = new Ellipse(id, numAttr(attrs, 'cx'), numAttr(attrs, 'cy'), numAttr(attrs, 'rx'), numAttr(attrs, 'ry'));
      applyStyle(e, attrs);
      return e;
    },
  );

  f.register(
    'line',
    (id, a) => {
      need(a, 4, 5, 'create line <id> <x1> <y1> <x2> <y2> [stroke]');
      const l = new Line(id, parseNum(a[0], 'x1'), parseNum(a[1], 'y1'), parseNum(a[2], 'x2'), parseNum(a[3], 'y2'));
      if (a[4] !== undefined) l.stroke = a[4];
      return l;
    },
    (id, attrs) => {
      const l = new Line(id, numAttr(attrs, 'x1'), numAttr(attrs, 'y1'), numAttr(attrs, 'x2'), numAttr(attrs, 'y2'));
      applyStyle(l, attrs);
      return l;
    },
  );

  f.register(
    'text',
    (id, a) => {
      need(a, 3, 3, 'create text <id> <x> <y> "content"');
      return new Text(id, parseNum(a[0], 'x'), parseNum(a[1], 'y'), a[2]);
    },
    (id, attrs, text) => {
      const t = new Text(id, numAttr(attrs, 'x'), numAttr(attrs, 'y'), text);
      applyStyle(t, attrs);
      return t;
    },
  );

  f.register(
    'g',
    (id, a) => {
      need(a, 0, 0, 'create g <id>');
      return new Group(id);
    },
    (id, attrs) => {
      const g = new Group(id);
      applyStyle(g, attrs);
      return g;
    },
  );

  return f;
}
