import { fmt, ModelError, parseNum, Shape } from '../Shape';

export class Rect extends Shape {
  constructor(
    id: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {
    super(id);
  }

  get tag(): string {
    return 'rect';
  }

  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  scale(factor: number): void {
    this.x *= factor;
    this.y *= factor;
    this.width *= factor;
    this.height *= factor;
  }

  anchor(): [number, number] {
    return [this.x, this.y];
  }

  geometrySummary(): string {
    return `x=${fmt(this.x)} y=${fmt(this.y)} w=${fmt(this.width)} h=${fmt(this.height)}`;
  }

  geometryDetail(): string {
    return `x=${fmt(this.x)} y=${fmt(this.y)} width=${fmt(this.width)} height=${fmt(this.height)}`;
  }

  protected geometryAttrs(): [string, string][] {
    return [
      ['x', fmt(this.x)],
      ['y', fmt(this.y)],
      ['width', fmt(this.width)],
      ['height', fmt(this.height)],
    ];
  }

  protected setGeometryAttribute(attr: string, value: string): void {
    switch (attr) {
      case 'x':
        this.x = parseNum(value, 'x');
        return;
      case 'y':
        this.y = parseNum(value, 'y');
        return;
      case 'width':
        this.width = parseNum(value, 'width');
        return;
      case 'height':
        this.height = parseNum(value, 'height');
        return;
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  protected getGeometryAttribute(attr: string): string | undefined {
    switch (attr) {
      case 'x':
        return fmt(this.x);
      case 'y':
        return fmt(this.y);
      case 'width':
        return fmt(this.width);
      case 'height':
        return fmt(this.height);
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  toSVG(indent: string): string {
    return `${indent}<${this.tag} ${this.attrsString()}/>`;
  }
}
