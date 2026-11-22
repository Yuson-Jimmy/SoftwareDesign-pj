import { ModelError, Shape } from './Shape';
import type { ShapeProvider } from './ShapeProvider';

/** 内核只消费 ShapeProvider，不导入任何具体图形实现。 */
export class ShapeFactory {
  private readonly providers = new Map<string, ShapeProvider>();

  register(provider: ShapeProvider): void {
    if (this.providers.has(provider.type)) {
      throw new ModelError(`shape provider already registered: ${provider.type}`);
    }
    this.providers.set(provider.type, provider);
  }

  has(type: string): boolean {
    return this.providers.has(type);
  }

  create(type: string, id: string, args: string[]): Shape {
    const provider = this.providers.get(type);
    if (!provider) throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    return provider.create(id, args);
  }

  load(type: string, id: string, attrs: Record<string, string>, text: string): Shape | null {
    return this.providers.get(type)?.load(id, attrs, text) ?? null;
  }

  types(): string[] {
    return [...this.providers.keys()];
  }
}
