import type { Plugin } from '../Plugin';
import { StatsCommand } from './StatsCommand';

/** 独立插件：不装配它不会影响 dir 或任何内置命令。 */
export const statsPlugin: Plugin = {
  name: 'stats',
  commands: [new StatsCommand()],
};

export default statsPlugin;
