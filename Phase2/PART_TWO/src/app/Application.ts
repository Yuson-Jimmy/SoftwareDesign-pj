import { CommandRegistry, createDefaultRegistry } from '../commands/CommandRegistry';
import { CommandsExecutor } from '../commands_executor/CommandsExecutor';
import { AttributeRegistry } from '../model/AttributeHandler';
import { EditorModel } from '../model/EditorModel';
import { ShapeFactory } from '../model/ShapeFactory';
import type { TreeDecorator } from '../model/TreeDecorator';
import { boxPlugin } from '../plugins/box/BoxPlugin';
import { builtinShapePlugin } from '../plugins/builtin/BuiltinShapePlugin';
import { createModifiedStarPlugin } from '../plugins/builtin/ModifiedStarPlugin';
import { createDirPlugin } from '../plugins/commands/DirPlugin';
import { statsPlugin } from '../plugins/commands/StatsPlugin';
import { createPingPlugin, pingManifest } from '../plugins/demo/PingPlugin';
import type { Plugin, PluginManifest, PluginOptions } from '../plugins/Plugin';
import { PluginRegistrar } from './PluginRegistrar';

export interface Application {
  readonly factory: ShapeFactory;
  readonly attributes: AttributeRegistry;
  readonly registry: CommandRegistry;
  readonly executor: CommandsExecutor;
  readonly model: EditorModel;
  installPlugin(plugin: Plugin, manifest?: PluginManifest, options?: PluginOptions): string | null;
}

/** 唯一组合根：代码装配与配置装配最终都调用同一个 installPlugin。 */
export function createApplication(plugins: Plugin[]): Application {
  const factory = new ShapeFactory();
  const attributes = new AttributeRegistry();
  const registry = createDefaultRegistry();
  const decorators: TreeDecorator[] = [];
  const registrar = new PluginRegistrar(factory, attributes, registry, decorators);
  const model = new EditorModel(factory, attributes, decorators);
  const application: Application = {
    factory,
    attributes,
    registry,
    executor: new CommandsExecutor(model),
    model,
    installPlugin: (plugin, manifest, options) => registrar.install(plugin, manifest, options),
  };

  for (const plugin of plugins) {
    const error = application.installPlugin(plugin);
    if (error) throw new Error(error);
  }
  return application;
}

/** 方式 A：显式导入和实例化，新增插件只改这一处并重新构建。 */
export function createDefaultApplication(): Application {
  const application = createApplication([
    builtinShapePlugin,
    boxPlugin,
    createModifiedStarPlugin(),
    statsPlugin,
    createDirPlugin(),
  ]);
  const error = application.installPlugin(createPingPlugin({ text: 'configured' }), pingManifest);
  if (error) throw new Error(error);
  return application;
}
