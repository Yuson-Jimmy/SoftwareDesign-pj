import * as fs from 'node:fs';
import { CommandError } from '../../commands/Command';
import type { DirectoryPort } from './DirCommand';

/** Adapter：把 Node Dirent API 适配为命令需要的字符串列表端口。 */
export class NodeDirectoryAdapter implements DirectoryPort {
  list(path: string): string[] {
    try {
      return fs.readdirSync(path, { withFileTypes: true })
        .map((entry) => entry.isDirectory() ? `${entry.name}/` : entry.name)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      throw new CommandError(`cannot read directory: ${path}`);
    }
  }
}
