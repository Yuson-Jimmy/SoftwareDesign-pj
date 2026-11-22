import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, requireDoc, rethrow } from '../Command';

/**
 * ungroup <gid>：解散容器，子图形提升到原容器的父级、占据原容器的位置。
 * 根级容器（svg 直接子节点）不允许解散。
 */
export class UngroupCommand implements Command {
  readonly name = 'ungroup';
  readonly usage = 'ungroup <gid>';

  execute(executor: CommandsExecutor, args: string[]): string {
    requireDoc(executor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    try {
      return executor.ungroup(args[0]);
    } catch (err) {
      return rethrow(err);
    }
  }
}
