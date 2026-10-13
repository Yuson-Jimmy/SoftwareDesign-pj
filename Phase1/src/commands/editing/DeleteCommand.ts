import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, mustFind } from '../Command';

/** delete <id>：容器连同全部子孙删除；一个 undo 单元还原 */
export class DeleteCommand implements Command {
  readonly name = 'delete';
  readonly usage = 'delete <id>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);

    const { parent, index } = d.detach(shape);
    const parentLabel = parent === d.root ? 'svg' : parent.label;

    editor.pushHistory({
      undo: () => {
        d.attach(shape, parent, index);
        return `${shape.label} restored into ${parentLabel}`;
      },
      redo: () => {
        d.detach(shape);
        return `${shape.label} deleted`;
      },
    });
    return `${shape.label} deleted`;
  }
}
