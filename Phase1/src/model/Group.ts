import { Shape } from './Shape';

/** 容器图形 <g>：Composite，子图形有序，操作递归到子孙 */
export class Group extends Shape {
  readonly children: Shape[] = [];

  constructor(id: string) {
    super(id);
  }

  get tag(): string {
    return 'g';
  }

  move(dx: number, dy: number): void {
    for (const child of this.children) child.move(dx, dy);
  }

  scale(factor: number): void {
    for (const child of this.children) child.scale(factor);
  }

  /** 容器没有单一锚点，移动反馈用增量形式 */
  anchor(): null {
    return null;
  }

  geometrySummary(): string {
    return '';
  }

  geometryDetail(): string {
    return `children=${this.children.length}`;
  }

  protected geometryAttrs(): [string, string][] {
    return [];
  }

  indexOf(child: Shape): number {
    return this.children.indexOf(child);
  }

  insert(child: Shape, index?: number): void {
    if (index === undefined || index < 0 || index > this.children.length) {
      this.children.push(child);
    } else {
      this.children.splice(index, 0, child);
    }
    child.parent = this;
  }

  remove(child: Shape): number {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
    }
    return i;
  }

  /** 是否为空容器 */
  get isEmpty(): boolean {
    return this.children.length === 0;
  }

  /** 先序遍历（含自身） */
  *walk(): Generator<Shape> {
    yield this;
    for (const child of this.children) {
      if (child instanceof Group) {
        yield* child.walk();
      } else {
        yield child;
      }
    }
  }

  toSVG(indent: string): string {
    const open = `${indent}<${this.tag} ${this.attrsString()}>`;
    const inner = this.children.map((c) => c.toSVG(indent + '  ')).join('\n');
    return `${open}\n${inner}\n${indent}</${this.tag}>`;
  }
}
