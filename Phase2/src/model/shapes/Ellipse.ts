import { fmt, ModelError, parseNum, Shape } from '../Shape';

export class Ellipse extends Shape {
  constructor(
    id: string,
    public cx: number,
    public cy: number,
    public rx: number,
    public ry: number,
  ) {
    super(id);
  }

  get tag(): string {
    return 'ellipse';
  }

  move(dx: number, dy: number): void {
    this.cx += dx;
    this.cy += dy;
  }

  scale(factor: number): void {
    this.cx *= factor;
    this.cy *= factor;
    this.rx *= factor;
    this.ry *= factor;
  }

  anchor(): [number, number] {
    return [this.cx, this.cy];
  }

  geometrySummary(): string {
    return `cx=${fmt(this.cx)} cy=${fmt(this.cy)} rx=${fmt(this.rx)} ry=${fmt(this.ry)}`;
  }

  geometryDetail(): string {
    return this.geometrySummary();
  }

  protected geometryAttrs(): [string, string][] {
    return [
      ['cx', fmt(this.cx)],
      ['cy', fmt(this.cy)],
      ['rx', fmt(this.rx)],
      ['ry', fmt(this.ry)],
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
      case 'rx':
        this.rx = parseNum(value, 'rx');
        return;
      case 'ry':
        this.ry = parseNum(value, 'ry');
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
      case 'rx':
        return fmt(this.rx);
      case 'ry':
        return fmt(this.ry);
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  toSVG(indent: string): string {
    return `${indent}<${this.tag} ${this.attrsString()}/>`;
  }
}
