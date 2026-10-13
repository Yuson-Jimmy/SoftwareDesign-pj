import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, mustFind } from '../Command';

/** show <id>：单个图形的属性明细 */
export class ShowCommand implements Command {
  readonly name = 'show';
  readonly usage = 'show <id>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);

    const lines = [`${shape.label}  parent=${d.parentLabel(shape)}`];
    const geo = shape.geometryDetail();
    if (geo) lines.push(`  ${geo}`);
    for (const line of shape.styleDetailLines()) {
      lines.push(`  ${line}`);
    }
    return lines.join('\n');
  }
}
