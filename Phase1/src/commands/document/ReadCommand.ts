import type { Editor } from '../../editor/Editor';
import { ModelError } from '../../model/Shape';
import type { SvgReader } from '../../model/SvgReader';
import { Command, CommandError } from '../Command';

/** read <file.svg>：读入 SVG 为当前文档；缺 id 自动补并逐条警告 */
export class ReadCommand implements Command {
  readonly name = 'read';
  readonly usage = 'read <file.svg>';

  constructor(private readonly reader: SvgReader) {}

  execute(editor: Editor, args: string[]): string {
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const path = args[0];
    try {
      const { doc, warnings } = this.reader.readFile(path);
      editor.setDocument(doc, path);
      return [...warnings, `read ${path} (${doc.count()} elements)`].join('\n');
    } catch (err) {
      if (err instanceof ModelError) throw new CommandError(err.message);
      throw err;
    }
  }
}
