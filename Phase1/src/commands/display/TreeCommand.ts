import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/** tree [id]：结构树，内联关键几何属性（渲染在模型内完成，薄壳转发） */
export class TreeCommand implements Command {
  readonly name = 'tree';
  readonly usage = 'tree [id]';

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length > 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.tree(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
