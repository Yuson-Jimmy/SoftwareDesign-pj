import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, rethrow } from '../Command';

/**
 * create <type> <id> [params…] [in <containerId>]
 * in 子句只认倒数第二位是 in 的尾缀形式，避免与 text 内容撞车。
 */
export class CreateCommand implements Command {
  readonly name = 'create';
  readonly usage = 'create <type> <id> [params…] [in <containerId>]';

  execute(executor: CommandsExecutor, args: string[]): string {
    doc(executor);
    if (args.length < 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const [type, id] = args;

    let params = args.slice(2);
    let containerId: string | undefined;
    if (params.length >= 2 && params[params.length - 2] === 'in') {
      containerId = params[params.length - 1];
      params = params.slice(0, -2);
    }

    try {
      return executor.create(type, id, params, containerId);
    } catch (err) {
      return rethrow(err);
    }
  }
}
