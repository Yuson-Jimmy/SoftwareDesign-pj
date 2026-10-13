import type { Editor } from '../editor/Editor';
import { Command, CommandError, rethrow } from './Command';

/** redo：重做；undo 后若有新编辑，redo 栈已被 Editor 清空 */
export class RedoCommand implements Command {
  readonly name = 'redo';
  readonly usage = 'redo';

  execute(editor: Editor, args: string[]): string {
    if (args.length !== 0) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return editor.redo();
    } catch (err) {
      return rethrow(err);
    }
  }
}
