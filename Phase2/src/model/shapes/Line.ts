import { fmt, ModelError, parseNum, Shape } from '../Shape';

export class Line extends Shape {
  constructor(
    id: string,
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,
  ) {
    super(id);
  }

  get tag(): string {
    return 'line';
  }

  move(dx: number, dy: number): void {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  scale(factor: number): void {
    this.x1 *= factor;
    this.y1 *= factor;
    this.x2 *= factor;
    this.y2 *= factor;
  }

  /** 线没有单一锚点，移动反馈用增量形式 */
  anchor(): null {
    return null;
  }

  geometrySummary(): string {
    return `(${fmt(this.x1)},${fmt(this.y1)}) -> (${fmt(this.x2)},${fmt(this.y2)})`;
  }

  geometryDetail(): string {
    return `x1=${fmt(this.x1)} y1=${fmt(this.y1)} x2=${fmt(this.x2)} y2=${fmt(this.y2)}`;
  }

  protected geometryAttrs(): [string, string][] {
    return [
      ['x1', fmt(this.x1)],
      ['y1', fmt(this.y1)],
      ['x2', fmt(this.x2)],
      ['y2', fmt(this.y2)],
    ];
  }

  protected setGeometryAttribute(attr: string, value: string): void {
    switch (attr) {
      case 'x1':
        this.x1 = parseNum(value, 'x1');
        return;
      case 'y1':
        this.y1 = parseNum(value, 'y1');
        return;
      case 'x2':
        this.x2 = parseNum(value, 'x2');
        return;
      case 'y2':
        this.y2 = parseNum(value, 'y2');
        return;
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  protected getGeometryAttribute(attr: string): string | undefined {
    switch (attr) {
      case 'x1':
        return fmt(this.x1);
      case 'y1':
        return fmt(this.y1);
      case 'x2':
        return fmt(this.x2);
      case 'y2':
        return fmt(this.y2);
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  toSVG(indent: string): string {
    return `${indent}<${this.tag} ${this.attrsString()}/>`;
  }
}
