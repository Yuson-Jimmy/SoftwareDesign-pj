import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Plugin, PluginManifest } from '../plugins/Plugin';

export class PluginNotFoundError extends Error {}
export class PluginLoadError extends Error {}
export class PluginDefaultExportError extends Error {}

export interface LoadedPlugin {
  plugin: Plugin;
  manifest: PluginManifest;
}

function manifestNear(moduleTarget: string, resolved: string): PluginManifest {
  const direct = path.join(moduleTarget, 'package.json');
  let current = fs.existsSync(direct) ? direct : '';
  if (!current) {
    let directory = path.dirname(resolved);
    while (true) {
      const candidate = path.join(directory, 'package.json');
      if (fs.existsSync(candidate)) {
        current = candidate;
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  if (!current) throw new PluginLoadError('package.json not found');
  const manifest = JSON.parse(fs.readFileSync(current, 'utf8')) as PluginManifest;
  if (typeof manifest.name !== 'string') throw new PluginLoadError('invalid plugin package manifest');
  return manifest;
}

/** 通用模块加载：没有具体插件导入、名称映射或条件分支。 */
export function loadPlugin(moduleName: string, configDirectory: string): LoadedPlugin {
  const relative = moduleName.startsWith('.') || path.isAbsolute(moduleName);
  const moduleTarget = relative ? path.resolve(configDirectory, moduleName) : moduleName;
  let resolved: string;
  try {
    resolved = require.resolve(moduleTarget);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      throw new PluginNotFoundError(moduleName);
    }
    throw new PluginLoadError(error instanceof Error ? error.message : String(error));
  }

  let exported: { default?: Plugin };
  let manifest: PluginManifest;
  try {
    // 模块求值及依赖错误属于插件加载失败，不能误报为顶层模块找不到。
    exported = require(resolved) as { default?: Plugin };
    if (!exported.default) throw new PluginDefaultExportError(moduleName);
    manifest = manifestNear(moduleTarget, resolved);
  } catch (error) {
    if (error instanceof PluginDefaultExportError) throw error;
    throw new PluginLoadError(error instanceof Error ? error.message : String(error));
  }
  if (!exported.default) throw new PluginDefaultExportError(moduleName);
  return { plugin: exported.default, manifest };
}
