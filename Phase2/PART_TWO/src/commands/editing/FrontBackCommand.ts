import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/** front <id> / back <id>：同级 z-order 调到最前（最后绘制）/ 最后（最先绘制） */
export class FrontBackCommand implements Command {
  readonly usage = 'front <id> / back <id>';

  constructor(readonly name: 'front' | 'back') {}

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return this.name === 'front' ? executor.front(args[0]) : executor.back(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
