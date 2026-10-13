import type { Editor } from '../../editor/Editor';
import { ModelError } from '../../model/Shape';
import { Command, CommandError, doc, mustFind, rethrow } from '../Command';

/** set <id> <attr> <value>：白名单内的属性改写；记录旧值用于撤销 */
export class SetCommand implements Command {
  readonly name = 'set';
  readonly usage = 'set <id> <attr> <value>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 3) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);
    const [, attr, value] = args;

    // 先取旧值：既做白名单校验（unknown attribute），又留撤销快照
    let oldValue: string | undefined;
    try {
      oldValue = shape.getAttribute(attr);
      shape.setAttribute(attr, value);
    } catch (err) {
      if (err instanceof ModelError) throw new CommandError(err.message);
      rethrow(err);
    }

    const message = `${shape.label} updated: ${attr}="${value}"`;
    const undoMessage =
      oldValue === undefined
        ? `${shape.label} updated: ${attr} unset`
        : `${shape.label} updated: ${attr}="${oldValue}"`;

    editor.pushHistory({
      undo: () => {
        if (oldValue === undefined) {
          shape.clearAttribute(attr);
        } else {
          shape.setAttribute(attr, oldValue);
        }
        return undoMessage;
      },
      redo: () => {
        shape.setAttribute(attr, value);
        return message;
      },
    });
    return message;
  }
}
