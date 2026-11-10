import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/**
 * group <newGid> <id1> <id2>…：
 * 新建容器并收入若干已有图形（从各自原父容器摘出，保持给定顺序）。
 */
export class GroupCommand implements Command {
  readonly name = 'group';
  readonly usage = 'group <newGid> <id1> <id2>…';

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length < 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const [gid, ...ids] = args;
    try {
      return executor.group(gid, ids);
    } catch (err) {
      return rethrow(err);
    }
  }
}
