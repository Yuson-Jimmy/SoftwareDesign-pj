import * as fs from 'node:fs';
import * as path from 'node:path';
import { Application, createApplication, createDefaultApplication } from './Application';
import { loadPlugin, PluginDefaultExportError, PluginLoadError, PluginNotFoundError } from './PluginCatalog';
import type { PluginOptions } from '../plugins/Plugin';

export interface PluginConfigurationEntry {
  module: string;
  options?: PluginOptions;
  enabled?: boolean;
}
export interface PluginConfiguration {
  plugins: PluginConfigurationEntry[];
}

function validConfig(value: unknown): value is PluginConfiguration {
  if (!value || typeof value !== 'object' || !Array.isArray((value as PluginConfiguration).plugins)) return false;
  return (value as PluginConfiguration).plugins.every((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.module !== 'string' || entry.module === '') return false;
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') return false;
    return entry.options === undefined || (!!entry.options && typeof entry.options === 'object' && !Array.isArray(entry.options));
  });
}

/** 方式 B：配置仅决定模块、顺序与 options；所有注册仍走 Application.installPlugin。 */
export function createConfiguredApplication(
  configPath: string,
  report: (message: string) => void = (message) => console.error(message),
): Application {
  let config: unknown;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    report('error: invalid plugin config');
    return createDefaultApplication();
  }
  if (!validConfig(config)) {
    report('error: invalid plugin config');
    return createDefaultApplication();
  }

  const application = createApplication([]);
  const directory = path.dirname(path.resolve(configPath));
  for (const entry of config.plugins) {
    if (entry.enabled === false) continue;
    try {
      const { plugin, manifest } = loadPlugin(entry.module, directory);
      const error = application.installPlugin(plugin, manifest, entry.options ?? {});
      if (error) report(error);
    } catch (error) {
      if (error instanceof PluginNotFoundError) report(`error: plugin not found: ${entry.module}`);
      else if (error instanceof PluginDefaultExportError) report(`error: plugin has no default export: ${entry.module}`);
      else if (error instanceof PluginLoadError) {
        const reason = error instanceof Error ? error.message : String(error);
        report(`error: plugin failed to activate: ${entry.module} (${reason})`);
      } else throw error;
    }
  }
  return application;
}
