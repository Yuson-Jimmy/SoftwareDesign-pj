import type { Plugin } from '../Plugin';
import { DirCommand, DirectoryPort } from './DirCommand';
import { NodeDirectoryAdapter } from './NodeDirectoryAdapter';

/** 同一命令与端口可用于代码装配；配置装配使用默认 Node 适配器。 */
export function createDirPlugin(directory: DirectoryPort = new NodeDirectoryAdapter()): Plugin {
  return {
    name: 'dir',
    commands: [new DirCommand(directory)],
  };
}

export default createDirPlugin();
