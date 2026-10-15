import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, rethrow } from '../Command';

/** save [file.svg]：保存当前文档；无参数时保存到读入时的路径 */
export class SaveCommand implements Command {
  readonly name = 'save';
  readonly usage = 'save [file.svg]';

  execute(executor: CommandsExecutor, args: string[]): string {
    doc(executor);
    if (args.length > 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.save(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
