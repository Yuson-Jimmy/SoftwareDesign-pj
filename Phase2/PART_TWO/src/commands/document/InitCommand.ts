import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, rethrow } from '../Command';

/** init [w] [h]：新建空画布（默认 800×600），作为当前文档 */
export class InitCommand implements Command {
  readonly name = 'init';
  readonly usage = 'init [w] [h]';

  execute(executor: CommandsExecutor, args: string[]): string {
    if (args.length !== 0 && args.length !== 2) {
      throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    }
    // NaN 与正数校验在 model 的 init 指令中统一完成
    const w = args.length === 2 ? Number(args[0]) : 800;
    const h = args.length === 2 ? Number(args[1]) : 600;
    try {
      return executor.init(w, h);
    } catch (err) {
      return rethrow(err);
    }
  }
}
