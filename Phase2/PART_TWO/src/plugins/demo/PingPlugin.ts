import type { Command } from '../../commands/Command';
import { CommandError } from '../../commands/Command';
import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import type { Plugin, PluginManifest, PluginOptions } from '../Plugin';

/** 仅用于证明 A/B 接入差异边界的无状态命令。 */
export class PingCommand implements Command {
  readonly name = 'ping';
  readonly usage = 'ping';

  constructor(private readonly text = '') {}

  execute(_executor: CommandsExecutor, args: string[]): string {
    if (args.length > 0) throw new CommandError('invalid arguments, usage: ping');
    return this.text ? `pong ${this.text}` : 'pong';
  }
}

export const pingManifest: PluginManifest = {
  name: 'ping-demo',
  contributes: { commands: ['ping'] },
};

export function createPingPlugin(defaultOptions: PluginOptions = {}): Plugin {
  return {
    name: 'ping-demo',
    activate(context, options) {
      const effective = { ...defaultOptions, ...options };
      context.registerCommand(new PingCommand(typeof effective.text === 'string' ? effective.text : ''));
    },
  };
}

export default createPingPlugin();
