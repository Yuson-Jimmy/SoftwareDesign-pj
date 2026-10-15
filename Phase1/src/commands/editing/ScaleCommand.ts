import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, mustFind, parseNumber, rethrow } from '../Command';

/** scale <id> <factor>：等比缩放全部几何属性；容器递归到每个子孙 */
export class ScaleCommand implements Command {
  readonly name = 'scale';
  readonly usage = 'scale <id> <factor>';

  execute(executor: CommandsExecutor, args: string[]): string {
    const d = doc(executor);
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    // 只读预检：保持「no such shape」优先于「invalid number」的报错顺序
    mustFind(d, args[0]);
    const factor = parseNumber(args[1], 'factor');
    try {
      return executor.scale(args[0], factor);
    } catch (err) {
      return rethrow(err);
    }
  }
}
