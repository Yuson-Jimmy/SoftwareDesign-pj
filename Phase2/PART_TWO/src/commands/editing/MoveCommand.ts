import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/**
 * move <id> <dx> <dy>：增量平移；容器整体平移。
 * dx/dy 以原始字符串透传：数字解析在模型指令内部、mustFind 之后进行，
 * 保持「no such shape 优先于 invalid number」的报错顺序。
 */
export class MoveCommand implements Command {
  readonly name = 'move';
  readonly usage = 'move <id> <dx> <dy>';

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length !== 3) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.move(args[0], args[1], args[2]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
