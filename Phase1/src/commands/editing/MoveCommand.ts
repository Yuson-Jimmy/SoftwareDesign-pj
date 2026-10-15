import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, mustFind, parseNumber, rethrow } from '../Command';

/** move <id> <dx> <dy>：增量平移；容器整体平移 */
export class MoveCommand implements Command {
  readonly name = 'move';
  readonly usage = 'move <id> <dx> <dy>';

  execute(executor: CommandsExecutor, args: string[]): string {
    const d = doc(executor);
    if (args.length !== 3) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    // 只读预检：保持「no such shape」优先于「invalid number」的报错顺序
    mustFind(d, args[0]);
    const dx = parseNumber(args[1], 'dx');
    const dy = parseNumber(args[2], 'dy');
    try {
      return executor.move(args[0], dx, dy);
    } catch (err) {
      return rethrow(err);
    }
  }
}
