import type { CommandRegistry } from '../commands/CommandRegistry';
import type { AttributeHandler, AttributeRegistry } from '../model/AttributeHandler';
import type { ShapeFactory } from '../model/ShapeFactory';
import type { ShapeProvider } from '../model/ShapeProvider';
import type { TreeDecorator } from '../model/TreeDecorator';
import type { Command } from '../commands/Command';
import type { Plugin, PluginContext, PluginManifest, PluginOptions } from '../plugins/Plugin';

export const contributionCategories = ['shapes', 'commands', 'decorators', 'attributes'] as const;
export type ContributionCategory = typeof contributionCategories[number];
type Registration = { category: ContributionCategory; name: string; value: ShapeProvider | Command | TreeDecorator | AttributeHandler };

class DuplicateRegistrationError extends Error {}

function names(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function formatContributions(entries: Readonly<Record<ContributionCategory, string[]>>): string {
  return contributionCategories
    .filter((category) => entries[category].length > 0)
    .map((category) => `${category}=${entries[category].join(',')}`)
    .join(';') || '(none)';
}

export function inferredManifest(plugin: Plugin): PluginManifest {
  return {
    name: plugin.name,
    contributes: {
      shapes: plugin.shapes?.map((provider) => provider.type),
      commands: plugin.commands?.map((command) => command.name),
      decorators: plugin.treeDecorators?.map((decorator) => decorator.name),
      attributes: plugin.attributes?.map((handler) => handler.name ?? `${handler.shapeType}.${handler.attribute}`),
    },
  };
}

/** A/B 共用的暂存、查重、清单校验和提交路径。 */
export class PluginRegistrar {
  constructor(
    private readonly factory: ShapeFactory,
    private readonly attributes: AttributeRegistry,
    private readonly registry: CommandRegistry,
    private readonly decorators: TreeDecorator[],
  ) {}

  /** 返回 null 表示成功；否则返回完整 error 文本，且没有任何暂存注册泄漏。 */
  install(plugin: Plugin, manifest: PluginManifest = inferredManifest(plugin), options: PluginOptions = {}): string | null {
    const staged: Registration[] = [];
    const context: PluginContext = {
      registerShape: (value) => this.stage(staged, 'shapes', value.type, value),
      registerCommand: (value) => this.stage(staged, 'commands', value.name, value),
      registerDecorator: (value) => this.stage(staged, 'decorators', value.name, value),
      registerAttribute: (value) => this.stage(staged, 'attributes', value.name ?? `${value.shapeType}.${value.attribute}`, value),
    };

    try {
      if (plugin.activate) {
        plugin.activate(context, options);
      } else {
        for (const value of plugin.shapes ?? []) context.registerShape(value);
        for (const value of plugin.commands ?? []) context.registerCommand(value);
        for (const value of plugin.treeDecorators ?? []) context.registerDecorator(value);
        for (const value of plugin.attributes ?? []) context.registerAttribute(value);
      }
    } catch (error) {
      if (error instanceof DuplicateRegistrationError) return `error: ${error.message}`;
      const reason = error instanceof Error ? error.message : String(error);
      return `error: plugin failed to activate: ${plugin.name} (${reason})`;
    }

    const registered: Record<ContributionCategory, string[]> = {
      shapes: [], commands: [], decorators: [], attributes: [],
    };
    for (const entry of staged) registered[entry.category].push(entry.name);
    for (const category of contributionCategories) registered[category].sort();
    const declared: Record<ContributionCategory, string[]> = {
      shapes: names(manifest.contributes?.shapes),
      commands: names(manifest.contributes?.commands),
      decorators: names(manifest.contributes?.decorators),
      attributes: names(manifest.contributes?.attributes),
    };
    if (contributionCategories.some((category) => declared[category].join('\0') !== registered[category].join('\0'))) {
      return `error: plugin manifest mismatch: ${manifest.name} (declared: ${formatContributions(declared)}, registered: ${formatContributions(registered)})`;
    }

    // 所有可能失败的检查均已完成；提交阶段不会留下半安装插件。
    for (const entry of staged) {
      if (entry.category === 'shapes') this.factory.register(entry.value as ShapeProvider);
      else if (entry.category === 'commands') this.registry.register(entry.value as Command);
      else if (entry.category === 'decorators') this.decorators.push(entry.value as TreeDecorator);
      else this.attributes.register(entry.value as AttributeHandler);
    }
    return null;
  }

  private stage(
    staged: Registration[],
    category: ContributionCategory,
    name: string,
    value: Registration['value'],
  ): void {
    if (staged.some((entry) => entry.category === category && entry.name === name) || this.exists(category, name)) {
      throw new DuplicateRegistrationError(`duplicate registration: ${category}/${name}`);
    }
    staged.push({ category, name, value });
  }

  private exists(category: ContributionCategory, name: string): boolean {
    if (category === 'shapes') return this.factory.has(name);
    if (category === 'commands') return this.registry.has(name);
    if (category === 'decorators') return this.decorators.some((decorator) => decorator.name === name);
    return this.attributes.has(name);
  }
}
