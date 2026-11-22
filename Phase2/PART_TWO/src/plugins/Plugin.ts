import type { Command } from '../commands/Command';
import type { AttributeHandler } from '../model/AttributeHandler';
import type { ShapeProvider } from '../model/ShapeProvider';
import type { TreeDecorator } from '../model/TreeDecorator';

/** 可选扩展的组合包；装配器逐项注册，不要求第三方插件框架。 */
export interface Plugin {
  readonly name: string;
  readonly shapes?: ShapeProvider[];
  readonly commands?: Command[];
  readonly treeDecorators?: TreeDecorator[];
  readonly attributes?: AttributeHandler[];
}
