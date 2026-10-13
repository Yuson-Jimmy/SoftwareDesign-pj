import type { Editor } from '../../editor/Editor';
import { Group } from '../../model/Group';
import { Command, CommandError, doc, mustFind } from '../Command';

/**
 * ungroup <gid>：解散容器，子图形提升到原容器的父级、占据原容器的位置。
 * 根级容器（svg 直接子节点）不允许解散。
 */
export class UngroupCommand implements Command {
  readonly name = 'ungroup';
  readonly usage = 'ungroup <gid>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);
    if (!(shape instanceof Group)) throw new CommandError(`not a container: ${shape.id}`);
    const group = shape;
    const parent = group.parent ?? d.root;
    if (parent === d.root) {
      throw new CommandError(`cannot ungroup top-level container: ${group.id}`);
    }

    const index = parent.indexOf(group);
    const children = [...group.children];
    const parentLabel = parent.label;

    const apply = (): void => {
      d.detach(group);
      // 用 reparent 而不是直接 attach：先把子图形从 group 的 children 里摘干净
      for (let i = 0; i < children.length; i++) {
        d.reparent(children[i], parent, index + i);
      }
    };
    const revert = (): void => {
      d.attach(group, parent, index);
      for (const child of children) {
        d.reparent(child, group);
      }
    };

    apply();
    const message = `${group.label} ungrouped, ${children.length} children moved into ${parentLabel}`;
    editor.pushHistory({
      undo: () => {
        revert();
        return `${group.label} restored with ${children.length} children`;
      },
      redo: () => {
        apply();
        return message;
      },
    });
    return message;
  }
}
