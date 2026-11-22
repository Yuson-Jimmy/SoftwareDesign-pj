import * as fs from 'node:fs';
import { Application, createApplication } from './Application';
import { pluginByName } from './PluginCatalog';

export interface PluginConfiguration {
  plugins: string[];
}

/** JSON 配置装配：只声明启用项，命令实现和目录端口与代码装配完全相同。 */
export function createConfiguredApplication(path: string): Application {
  let config: PluginConfiguration;
  try {
    config = JSON.parse(fs.readFileSync(path, 'utf8')) as PluginConfiguration;
  } catch (error) {
    throw new Error(`cannot load plugin configuration: ${path}`, { cause: error });
  }
  if (!Array.isArray(config.plugins) || config.plugins.some((name) => typeof name !== 'string')) {
    throw new Error(`invalid plugin configuration: ${path}; expected { "plugins": string[] }`);
  }
  return createApplication(config.plugins.map(pluginByName));
}
