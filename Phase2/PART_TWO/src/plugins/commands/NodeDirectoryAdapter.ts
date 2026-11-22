import * as fs from 'node:fs';
import { CommandError } from '../../commands/Command';
import type { DirectoryEntry, DirectoryPort } from './DirCommand';

/** Adapter：把 Node Dirent API 适配为稳定的目录项端口；永不递归或跟随链接。 */
export class NodeDirectoryAdapter implements DirectoryPort {
  list(): DirectoryEntry[] {
    const cwd = process.cwd();
    try {
      return fs.readdirSync(cwd, { withFileTypes: true })
        .filter((entry) => entry.name !== '.' && entry.name !== '..')
        .map((entry) => ({
          name: entry.name,
          // 符号链接和其他特殊项不访问目标，统一按非目录项显示为 FILE。
          kind: entry.isDirectory() ? 'directory' as const : 'file' as const,
        }))
        .sort((a, b) => a.kind === b.kind
          ? a.name.localeCompare(b.name)
          : a.kind === 'directory' ? -1 : 1);
    } catch {
      throw new CommandError(`cannot read directory: ${cwd}`);
    }
  }
}
