import type { CommandsExecutor } from '../commands_executor/CommandsExecutor';
import { Command, CommandError, rethrow } from './Command';

/** undo：撤销上一次编辑命令（显示类跳过；文档类指令执行后禁止）——操作本身在 commands_executor 中实现 */
export class UndoCommand implements Command {
  readonly name = 'undo';
  readonly usage = 'undo';

  execute(executor: CommandsExecutor, args: string[]): string {
    if (args.length !== 0) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.undo();
    } catch (err) {
      return rethrow(err);
    }
  }
}
