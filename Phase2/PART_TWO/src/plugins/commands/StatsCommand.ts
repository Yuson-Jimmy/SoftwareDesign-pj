import { Command, CommandError, rethrow, requireDoc } from '../../commands/Command';

export class StatsCommand implements Command {
  readonly name = 'stats';
  readonly usage = 'stats';

  execute(executor: Parameters<Command['execute']>[0], args: string[]): string {
    requireDoc(executor);
    if (args.length !== 0) throw new CommandError('invalid arguments, usage: stats');
    try {
      return executor.stats();
    } catch (error) {
      rethrow(error);
    }
  }
}
