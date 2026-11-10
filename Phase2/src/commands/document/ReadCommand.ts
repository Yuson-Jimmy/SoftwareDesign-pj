import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, rethrow } from '../Command';

/** read <file.svg>：读入 SVG 为当前文档；缺 id 自动补并逐条警告 */
export class ReadCommand implements Command {
  readonly name = 'read';
  readonly usage = 'read <file.svg>';

  execute(executor: CommandsExecutor, args: string[]): string {
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.read(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
