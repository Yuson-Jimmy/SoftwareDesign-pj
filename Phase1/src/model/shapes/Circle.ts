import { fmt, ModelError, parseNum, Shape } from '../Shape';

export class Circle extends Shape {
  constructor(
    id: string,
    public cx: number,
    public cy: number,
    public r: number,
  ) {
    super(id);
  }

  get tag(): string {
    return 'circle';
  }

  move(dx: number, dy: number): void {
    this.cx += dx;
    this.cy += dy;
  }

  scale(factor: number): void {
    this.cx *= factor;
    this.cy *= factor;
    this.r *= factor;
  }

  anchor(): [number, number] {
    return [this.cx, this.cy];
  }

  geometrySummary(): string {
    return `cx=${fmt(this.cx)} cy=${fmt(this.cy)} r=${fmt(this.r)}`;
  }

  geometryDetail(): string {
    return this.geometrySummary();
  }

  protected geometryAttrs(): [string, string][] {
    return [
      ['cx', fmt(this.cx)],
      ['cy', fmt(this.cy)],
      ['r', fmt(this.r)],
    ];
  }

  protected setGeometryAttribute(attr: string, value: string): void {
    switch (attr) {
      case 'cx':
        this.cx = parseNum(value, 'cx');
        return;
      case 'cy':
        this.cy = parseNum(value, 'cy');
        return;
      case 'r':
        this.r = parseNum(value, 'r');
        return;
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  protected getGeometryAttribute(attr: string): string | undefined {
    switch (attr) {
      case 'cx':
        return fmt(this.cx);
      case 'cy':
        return fmt(this.cy);
      case 'r':
        return fmt(this.r);
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  toSVG(indent: string): string {
    return `${indent}<${this.tag} ${this.attrsString()}/>`;
  }
}
