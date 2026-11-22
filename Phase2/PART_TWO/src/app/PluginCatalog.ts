import { boxPlugin } from '../plugins/box/BoxPlugin';
import { builtinShapePlugin } from '../plugins/builtin/BuiltinShapePlugin';
import { modifiedStarPlugin } from '../plugins/builtin/ModifiedStarPlugin';
import { createDirPlugin } from '../plugins/commands/DirPlugin';
import { statsPlugin } from '../plugins/commands/StatsPlugin';
import type { Plugin } from '../plugins/Plugin';

/** 配置装配的允许清单；这里属于宿主装配层，不属于内核。 */
export function pluginByName(name: string): Plugin {
  switch (name) {
    case 'builtin-shapes': return builtinShapePlugin;
    case 'box': return boxPlugin;
    case 'modified-star': return modifiedStarPlugin;
    case 'stats': return statsPlugin;
    case 'dir': return createDirPlugin();
    default: throw new Error(`unknown plugin in configuration: ${name}`);
  }
}
