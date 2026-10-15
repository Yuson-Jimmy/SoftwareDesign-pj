import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, rethrow } from '../Command';

/** addto <gid> <id>：把已有图形移入容器（作为最后一个子节点） */
export class AddtoCommand implements Command {
  readonly name = 'addto';
  readonly usage = 'addto <gid> <id>';

  execute(executor: CommandsExecutor, args: string[]): string {
    doc(executor);
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.addTo(args[0], args[1]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
