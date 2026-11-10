import type { Group } from './Group';

/**
 * 领域错误：message 不带 error: 前缀，由 cli 层统一包装。
 * domainError 标记让 commands 层无需 import 本类即可识别
 * 「用户可见的领域错误」（结构化判别，保持依赖单向）。
 */
export class ModelError extends Error {
  readonly domainError = true;
}

/** 数字格式化：10.0 -> "10"，10.5 -> "10.5" */
export function fmt(n: number): string {
  return String(n);
}

export function parseNum(raw: string, what: string): number {
  const n = Number(raw);
  if (raw.trim() === '' || Number.isNaN(n)) {
    throw new ModelError(`invalid number for ${what}: ${raw}`);
  }
  return n;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 图形抽象基类：id、父容器、样式属性、统一操作（move/scale/set/toSVG）。
 * 容器与叶子一视同仁（Composite 语义），具体分派靠多态，禁止 switch(tag)。
 */
export abstract class Shape {
  parent: Group | null = null;
  fill?: string;
  stroke?: string;
  strokeWidth?: string;

  protected constructor(public readonly id: string) {}

  /** SVG 标签名 */
  abstract get tag(): string;

  /** 平移（增量）。容器递归到全部子孙。 */
  abstract move(dx: number, dy: number): void;

  /** 等比缩放：factor 同乘到全部几何属性（位置与尺寸）。容器递归。 */
  abstract scale(factor: number): void;

  /** 移动反馈用的代表位置（如 rect 的 x,y；circle 的 cx,cy）；null 表示无锚点（line/g） */
  abstract anchor(): [number, number] | null;

  /** tree 行内的几何摘要，如 "x=0 y=0 w=10 h=20"、"(20,40) \"hi\""；g 返回空串 */
  abstract geometrySummary(): string;

  /** show 的几何明细行，如 "cx=100 cy=100 r=20" */
  abstract geometryDetail(): string;

  /** 写回 SVG 标签的几何属性（id 与样式除外） */
  protected abstract geometryAttrs(): [string, string][];

  /** set 白名单：公共样式 + 各类型几何属性（text 另有 text 内容） */
  setAttribute(attr: string, value: string): void {
    if (attr === 'fill') {
      this.fill = value;
      return;
    }
    if (attr === 'stroke') {
      this.stroke = value;
      return;
    }
    if (attr === 'stroke-width') {
      this.strokeWidth = value;
      return;
    }
    this.setGeometryAttribute(attr, value);
  }

  /** 子类实现各自几何属性的写入；不认识的属性抛 unknown attribute */
  protected setGeometryAttribute(attr: string, _value: string): void {
    throw new ModelError(`unknown attribute: ${attr}`);
  }

  /** 读属性（undo 快照用）；未设置的样式属性返回 undefined */
  getAttribute(attr: string): string | undefined {
    if (attr === 'fill') return this.fill;
    if (attr === 'stroke') return this.stroke;
    if (attr === 'stroke-width') return this.strokeWidth;
    return this.getGeometryAttribute(attr);
  }

  protected getGeometryAttribute(attr: string): string | undefined {
    throw new ModelError(`unknown attribute: ${attr}`);
  }

  /** 撤销 set 时把「原本未设置」的样式属性还原为未设置（几何属性必有值，不支持清除） */
  clearAttribute(attr: string): void {
    if (attr === 'fill') {
      this.fill = undefined;
      return;
    }
    if (attr === 'stroke') {
      this.stroke = undefined;
      return;
    }
    if (attr === 'stroke-width') {
      this.strokeWidth = undefined;
      return;
    }
    throw new ModelError(`unknown attribute: ${attr}`);
  }

  /** 类型展示名（tree/show 用），默认等于 tag；复合图形插件可覆盖 */
  get kind(): string {
    return this.tag;
  }

  /** 显示名：rect#r1 */
  get label(): string {
    return `${this.kind}#${this.id}`;
  }

  protected styleAttrs(): [string, string][] {
    const out: [string, string][] = [];
    if (this.fill !== undefined) out.push(['fill', this.fill]);
    if (this.stroke !== undefined) out.push(['stroke', this.stroke]);
    if (this.strokeWidth !== undefined) out.push(['stroke-width', this.strokeWidth]);
    return out;
  }

  protected attrsString(): string {
    const all: [string, string][] = [['id', this.id], ...this.geometryAttrs(), ...this.styleAttrs()];
    return all.map(([k, v]) => `${k}="${escapeXml(v)}"`).join(' ');
  }

  /** 序列化为 SVG 片段（含缩进） */
  abstract toSVG(indent: string): string;

  /** show 输出的样式明细行（仅已设置的属性） */
  styleDetailLines(): string[] {
    const lines: string[] = [];
    if (this.fill !== undefined) lines.push(`fill=${this.fill}`);
    if (this.stroke !== undefined) lines.push(`stroke=${this.stroke}`);
    if (this.strokeWidth !== undefined) lines.push(`stroke-width=${this.strokeWidth}`);
    return lines;
  }
}
