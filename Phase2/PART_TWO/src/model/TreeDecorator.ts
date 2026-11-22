import type { Shape } from './Shape';

/** 树行尾标签扩展点；返回空数组表示不装饰。 */
export interface TreeDecorator {
  readonly name: string;
  decorations(shape: Shape): string[];
}
