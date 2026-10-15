import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, rethrow } from '../Command';

/** set <id> <attr> <value>：白名单内的属性改写；记录旧值用于撤销 */
export class SetCommand implements Command {
  readonly name = 'set';
  readonly usage = 'set <id> <attr> <value>';

  execute(executor: CommandsExecutor, args: string[]): string {
    doc(executor);
    if (args.length !== 3) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.set(args[0], args[1], args[2]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
