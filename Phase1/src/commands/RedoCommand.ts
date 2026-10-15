import type { CommandsExecutor } from '../commands_executor/CommandsExecutor';
import { Command, CommandError, rethrow } from './Command';

/** redo：重做；undo 后若有新编辑，redo 栈已被执行器清空——操作本身在 commands_executor 中实现 */
export class RedoCommand implements Command {
  readonly name = 'redo';
  readonly usage = 'redo';

  execute(executor: CommandsExecutor, args: string[]): string {
    if (args.length !== 0) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.redo();
    } catch (err) {
      return rethrow(err);
    }
  }
}
