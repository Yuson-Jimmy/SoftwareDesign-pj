import type { Editor } from '../../editor/Editor';
import { Command } from '../Command';

/** help：显示全部命令与语法（内容由 CommandRegistry 提供） */
export class HelpCommand implements Command {
  readonly name = 'help';
  readonly usage = 'help';

  constructor(private readonly catalog: () => { name: string; usage: string }[]) {}

  execute(_editor: Editor, _args: string[]): string {
    const entries = this.catalog();
    const width = Math.max(...entries.map((e) => e.name.length));
    const lines = ['commands:'];
    for (const e of entries) {
      lines.push(`  ${e.name.padEnd(width)}  ${e.usage}`);
    }
    return lines.join('\n');
  }
}
