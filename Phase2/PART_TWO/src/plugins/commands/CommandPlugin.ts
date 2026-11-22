import type { Plugin } from '../Plugin';
import { DirCommand } from './DirCommand';
import { NodeDirectoryAdapter } from './NodeDirectoryAdapter';
import { StatsCommand } from './StatsCommand';

export function createCommandPlugin(): Plugin {
  return {
    name: 'stats-dir',
    commands: [new StatsCommand(), new DirCommand(new NodeDirectoryAdapter())],
  };
}
