import type { Shape } from './Shape';

/** 图形扩展点：一种类型同时提供 CLI 创建与 SVG 读回语义。 */
export interface ShapeProvider {
  readonly type: string;
  create(id: string, args: string[]): Shape;
  load(id: string, attrs: Record<string, string>, text: string): Shape;
}
