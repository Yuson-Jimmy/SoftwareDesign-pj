import { Group } from './Group';
import { ModelError, parseNum, Shape } from './Shape';
import { Circle } from './shapes/Circle';
import { Ellipse } from './shapes/Ellipse';
import { Line } from './shapes/Line';
import { Rect } from './shapes/Rect';
import { Text } from './shapes/Text';

/** 由已解析的字符串参数构造图形；参数个数/非法数字在此校验 */
type Creator = (id: string, args: string[]) => Shape;

/**
 * 图形工厂：类型名 → 构造器。
 * 全系统仅两处按名字分派之一（另一处是 CommandRegistry），
 * 后续插件化阶段由 ShapeProvider 注册取代内核写死。
 */
export class ShapeFactory {
  private readonly creators = new Map<string, Creator>();

  register(type: string, creator: Creator): void {
    this.creators.set(type, creator);
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

  types(): string[] {
    return [...this.creators.keys()];
  }
}

function need(args: string[], min: number, max: number, usage: string): void {
  if (args.length < min || args.length > max) {
    throw new ModelError(`invalid arguments, usage: ${usage}`);
  }
}

/** 内核默认工厂：内置 rect / circle / ellipse / line / text / g 六种类型 */
export function createDefaultFactory(): ShapeFactory {
  const f = new ShapeFactory();

  f.register('rect', (id, a) => {
    need(a, 4, 5, 'create rect <id> <x> <y> <w> <h> [fill]');
    const r = new Rect(id, parseNum(a[0], 'x'), parseNum(a[1], 'y'), parseNum(a[2], 'w'), parseNum(a[3], 'h'));
    if (a[4] !== undefined) r.fill = a[4];
    return r;
  });

  f.register('circle', (id, a) => {
    need(a, 3, 4, 'create circle <id> <cx> <cy> <r> [fill]');
    const c = new Circle(id, parseNum(a[0], 'cx'), parseNum(a[1], 'cy'), parseNum(a[2], 'r'));
    if (a[3] !== undefined) c.fill = a[3];
    return c;
  });

  f.register('ellipse', (id, a) => {
    need(a, 5, 6, 'create ellipse <id> <cx> <cy> <rx> <ry> [fill]');
    const e = new Ellipse(id, parseNum(a[0], 'cx'), parseNum(a[1], 'cy'), parseNum(a[2], 'rx'), parseNum(a[3], 'ry'));
    if (a[5] !== undefined) e.fill = a[5];
    return e;
  });

  f.register('line', (id, a) => {
    need(a, 4, 5, 'create line <id> <x1> <y1> <x2> <y2> [stroke]');
    const l = new Line(id, parseNum(a[0], 'x1'), parseNum(a[1], 'y1'), parseNum(a[2], 'x2'), parseNum(a[3], 'y2'));
    if (a[4] !== undefined) l.stroke = a[4];
    return l;
  });

  f.register('text', (id, a) => {
    need(a, 3, 3, 'create text <id> <x> <y> "content"');
    return new Text(id, parseNum(a[0], 'x'), parseNum(a[1], 'y'), a[2]);
  });

  f.register('g', (id, a) => {
    need(a, 0, 0, 'create g <id>');
    return new Group(id);
  });

  return f;
}
