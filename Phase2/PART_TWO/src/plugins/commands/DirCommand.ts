import { Command, CommandError } from '../../commands/Command';

/** dir 只依赖端口，不直接依赖 Node 文件系统。 */
export interface DirectoryPort {
  list(path: string): string[];
}

export class DirCommand implements Command {
  readonly name = 'dir';
  readonly usage = 'dir [path]';

  constructor(private readonly directory: DirectoryPort) {}

  execute(_executor: Parameters<Command['execute']>[0], args: string[]): string {
    if (args.length > 1) throw new CommandError('invalid arguments, usage: dir [path]');
    return this.directory.list(args[0] ?? '.').join('\n');
  }
}
