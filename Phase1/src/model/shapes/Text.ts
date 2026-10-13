import { escapeXml, fmt, ModelError, parseNum, Shape } from '../Shape';

export class Text extends Shape {
  constructor(
    id: string,
    public x: number,
    public y: number,
    public content: string,
  ) {
    super(id);
  }

  get tag(): string {
    return 'text';
  }

  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  scale(factor: number): void {
    this.x *= factor;
    this.y *= factor;
  }

  anchor(): [number, number] {
    return [this.x, this.y];
  }

  geometrySummary(): string {
    return `(${fmt(this.x)},${fmt(this.y)}) "${this.content}"`;
  }

  geometryDetail(): string {
    return `x=${fmt(this.x)} y=${fmt(this.y)}`;
  }

  protected geometryAttrs(): [string, string][] {
    return [
      ['x', fmt(this.x)],
      ['y', fmt(this.y)],
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
      case 'text':
        this.content = value;
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
      case 'text':
        return this.content;
      default:
        throw new ModelError(`unknown attribute: ${attr}`);
    }
  }

  override styleDetailLines(): string[] {
    return [...super.styleDetailLines(), `text="${this.content}"`];
  }

  toSVG(indent: string): string {
    return `${indent}<${this.tag} ${this.attrsString()}>${escapeXml(this.content)}</${this.tag}>`;
  }
}
