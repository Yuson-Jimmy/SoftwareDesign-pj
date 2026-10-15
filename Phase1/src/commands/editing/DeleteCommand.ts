import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, rethrow } from '../Command';

/** delete <id>：容器连同全部子孙删除；一个 undo 单元还原 */
export class DeleteCommand implements Command {
  readonly name = 'delete';
  readonly usage = 'delete <id>';

  execute(executor: CommandsExecutor, args: string[]): string {
    doc(executor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.deleteShape(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
