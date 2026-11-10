import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/** show <id>：单个图形的属性明细（渲染在模型内完成，薄壳转发） */
export class ShowCommand implements Command {
  readonly name = 'show';
  readonly usage = 'show <id>';

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.show(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
