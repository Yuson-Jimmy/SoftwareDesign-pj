import { Command, CommandError } from '../../commands/Command';

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: 'directory' | 'file';
}

/** dir 只依赖端口，不直接依赖 Node 文件系统，也不接触 SVG 文档。 */
export interface DirectoryPort {
  list(): DirectoryEntry[];
}

export class DirCommand implements Command {
  readonly name = 'dir';
  readonly usage = 'dir';

  constructor(private readonly directory: DirectoryPort) {}

  execute(_executor: Parameters<Command['execute']>[0], args: string[]): string {
    if (args.length !== 0) throw new CommandError('invalid arguments, usage: dir');
    const entries = this.directory.list();
    if (entries.length === 0) return '(empty directory)';
    return entries.map((entry) => `${entry.kind === 'directory' ? '[DIR]' : '[FILE]'}  ${entry.name}`).join('\n');
  }
}
