import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, mustContainer, mustFind } from '../Command';

/** addto <gid> <id>：把已有图形移入容器（作为最后一个子节点） */
export class AddtoCommand implements Command {
  readonly name = 'addto';
  readonly usage = 'addto <gid> <id>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const group = mustContainer(d, args[0]);
    const shape = mustFind(d, args[1]);

    if (shape === group || d.isAncestor(shape, group)) {
      throw new CommandError(`cannot group a container into its own descendant: ${shape.id}`);
    }

    const oldParent = shape.parent ?? d.root;
    const oldIndex = oldParent.indexOf(shape);
    const oldLabel = oldParent === d.root ? 'svg' : oldParent.label;

    d.reparent(shape, group);
    const message = `${shape.label} added to ${group.label}`;

    editor.pushHistory({
      undo: () => {
        d.reparent(shape, oldParent, oldIndex);
        return `${shape.label} moved back to ${oldLabel}`;
      },
      redo: () => {
        d.reparent(shape, group);
        return message;
      },
    });
    return message;
  }
}
