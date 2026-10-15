import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/**
 * scale <id> <factor>：等比缩放全部几何属性；容器递归到每个子孙。
 * factor 以原始字符串透传，理由同 move（报错顺序由模型指令内部保证）。
 */
export class ScaleCommand implements Command {
  readonly name = 'scale';
  readonly usage = 'scale <id> <factor>';

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.scale(args[0], args[1]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
