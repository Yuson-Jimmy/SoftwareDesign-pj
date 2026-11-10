import type { CommandsExecutor } from '../commands_executor/CommandsExecutor';
import type { Command } from './Command';

/**
 * 组合命令：把若干子命令打包成一个 undo 单元。
 * 本阶段各编辑指令在 model 中自行维护逆操作状态，MacroCommand 作为基础设施
 * 预留给后续插件化阶段的复合图形操作（如 box 的多部件创建）。
 */
export class MacroCommand implements Command {
  readonly name = 'macro';
  readonly usage = '';
  private readonly children: Command[] = [];
  private args: string[] = [];

  add(command: Command): this {
    this.children.push(command);
    return this;
  }

  withArgs(args: string[]): this {
    this.args = args;
    return this;
  }

  execute(executor: CommandsExecutor): string {
    const outputs: string[] = [];
    for (const child of this.children) {
      outputs.push(child.execute(executor, this.args));
    }
    return outputs.join('\n');
  }
}
