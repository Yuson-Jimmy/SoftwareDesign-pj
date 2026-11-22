import type { Document } from '../../model/Document';
import type { Shape } from '../../model/Shape';
import type { TreeDecorator } from '../../model/TreeDecorator';
import type { Plugin } from '../Plugin';

/**
 * 以普通 SVG 内容快照判定 dirty；undo 回到保存内容时标记自然消失。
 * 所有状态都属于装饰器实例，应用之间不会共享修改记录。
 */
class ModifiedStarDecorator implements TreeDecorator {
  readonly name = 'modified-star';
  private savedContent = new WeakMap<Shape, string>();

  documentLoaded(document: Document): void {
    this.capture(document);
  }

  documentSaved(document: Document): void {
    this.capture(document);
  }

  decorations(shape: Shape): string[] {
    const saved = this.savedContent.get(shape);
    return saved === undefined || saved !== shape.toSVG('') ? ['*'] : [];
  }

  private capture(document: Document): void {
    this.savedContent = new WeakMap<Shape, string>();
    for (const shape of document.root.walk()) {
      this.savedContent.set(shape, shape.toSVG(''));
    }
  }
}

export function createModifiedStarPlugin(): Plugin {
  return {
    name: 'modified-star',
    treeDecorators: [new ModifiedStarDecorator()],
  };
}

/** 默认装配入口；每个 Application 也应通过工厂创建独立实例。 */
export const modifiedStarPlugin: Plugin = createModifiedStarPlugin();

export default createModifiedStarPlugin();
