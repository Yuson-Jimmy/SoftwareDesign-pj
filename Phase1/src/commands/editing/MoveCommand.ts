import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, movedMessage, mustFind, parseNumber } from '../Command';

/** move <id> <dx> <dy>：增量平移；容器整体平移 */
export class MoveCommand implements Command {
  readonly name = 'move';
  readonly usage = 'move <id> <dx> <dy>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 3) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);
    const dx = parseNumber(args[1], 'dx');
    const dy = parseNumber(args[2], 'dy');

    shape.move(dx, dy);
    const message = movedMessage(shape, dx, dy, false);

    editor.pushHistory({
      undo: () => {
        shape.move(-dx, -dy);
        return movedMessage(shape, -dx, -dy, true);
      },
      redo: () => {
        shape.move(dx, dy);
        return movedMessage(shape, dx, dy, false);
      },
    });
    return message;
  }
}
