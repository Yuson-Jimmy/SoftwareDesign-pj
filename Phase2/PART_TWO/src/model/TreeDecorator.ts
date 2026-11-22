import type { Document } from './Document';
import type { Shape } from './Shape';

/** 树行尾标签扩展点；返回空数组表示不装饰。 */
export interface TreeDecorator {
  readonly name: string;
  decorations(shape: Shape): string[];

  /** 通用文档生命周期通知；标签可自行维护基线，内核不认识标签语义。 */
  documentLoaded?(document: Document): void;
  documentSaved?(document: Document): void;
}
