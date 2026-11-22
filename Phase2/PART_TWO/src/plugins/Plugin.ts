import type { Command } from '../commands/Command';
import type { AttributeHandler } from '../model/AttributeHandler';
import type { ShapeProvider } from '../model/ShapeProvider';
import type { TreeDecorator } from '../model/TreeDecorator';

export type PluginOptions = Readonly<Record<string, unknown>>;

/** 插件唯一可见的注册端口；实现由装配层提供并负责事务暂存。 */
export interface PluginContext {
  registerShape(provider: ShapeProvider): void;
  registerCommand(command: Command): void;
  registerDecorator(decorator: TreeDecorator): void;
  registerAttribute(handler: AttributeHandler): void;
}

/** 可选扩展的组合包；activate 与声明式字段由同一个安装器处理。 */
export interface Plugin {
  readonly name: string;
  readonly shapes?: ShapeProvider[];
  readonly commands?: Command[];
  readonly treeDecorators?: TreeDecorator[];
  readonly attributes?: AttributeHandler[];
  activate?(context: PluginContext, options: PluginOptions): void;
}

export interface PluginContributions {
  readonly shapes?: string[];
  readonly commands?: string[];
  readonly decorators?: string[];
  readonly attributes?: string[];
}

export interface PluginManifest {
  readonly name: string;
  readonly contributes?: PluginContributions;
}
