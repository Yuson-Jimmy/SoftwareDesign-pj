import { CommandRegistry, createDefaultRegistry } from '../commands/CommandRegistry';
import { CommandsExecutor } from '../commands_executor/CommandsExecutor';
import { AttributeRegistry } from '../model/AttributeHandler';
import { EditorModel } from '../model/EditorModel';
import { ShapeFactory } from '../model/ShapeFactory';
import type { TreeDecorator } from '../model/TreeDecorator';
import { boxPlugin } from '../plugins/box/BoxPlugin';
import { builtinShapePlugin } from '../plugins/builtin/BuiltinShapePlugin';
import { modifiedStarPlugin } from '../plugins/builtin/ModifiedStarPlugin';
import { createCommandPlugin } from '../plugins/commands/CommandPlugin';
import type { Plugin } from '../plugins/Plugin';

export interface Application {
  readonly factory: ShapeFactory;
  readonly attributes: AttributeRegistry;
  readonly registry: CommandRegistry;
  readonly executor: CommandsExecutor;
  readonly model: EditorModel;
}

/** 唯一装配点：插件只贡献扩展，内核与 REPL 不识别具体插件。 */
export function createApplication(plugins: Plugin[]): Application {
  const factory = new ShapeFactory();
  const attributes = new AttributeRegistry();
  const registry = createDefaultRegistry();
  const decorators: TreeDecorator[] = [];

  for (const plugin of plugins) {
    for (const provider of plugin.shapes ?? []) factory.register(provider);
    for (const command of plugin.commands ?? []) registry.register(command);
    for (const decorator of plugin.treeDecorators ?? []) decorators.push(decorator);
    for (const handler of plugin.attributes ?? []) attributes.register(handler);
  }

  const model = new EditorModel(factory, attributes, decorators);
  return { factory, attributes, registry, executor: new CommandsExecutor(model), model };
}

/** 默认装配：Phase1 六图形和命令 + 本阶段 box/stats/dir/树装饰。 */
export function createDefaultApplication(): Application {
  return createApplication([
    builtinShapePlugin,
    boxPlugin,
    modifiedStarPlugin,
    createCommandPlugin(),
  ]);
}
