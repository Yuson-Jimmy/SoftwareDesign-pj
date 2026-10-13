import type { Editor } from '../editor/Editor';
import { Command, CommandError, rethrow } from './Command';

/** undo：撤销上一次编辑命令（显示类跳过；IO 类执行后禁止） */
export class UndoCommand implements Command {
  readonly name = 'undo';
  readonly usage = 'undo';

  execute(editor: Editor, args: string[]): string {
    if (args.length !== 0) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return editor.undo();
    } catch (err) {
      return rethrow(err);
    }
  }
}
