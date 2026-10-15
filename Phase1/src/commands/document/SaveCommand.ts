import type { Editor } from '../../editor/Editor';
import { ModelError } from '../../model/Shape';
import type { SvgWriter } from '../../model/SvgWriter';
import { Command, CommandError, doc } from '../Command';

/** save [file.svg]：保存当前文档；无参数时保存到读入时的路径 */
export class SaveCommand implements Command {
  readonly name = 'save';
  readonly usage = 'save [file.svg]';

  constructor(private readonly writer: SvgWriter) {}

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length > 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const path = args[0] ?? editor.source;
    if (!path) throw new CommandError('no file specified and no source path');
    try {
      this.writer.writeFile(d, path);
    } catch (err) {
      if (err instanceof ModelError) throw new CommandError(err.message);
      throw err;
    }
    editor.markIo();
    return `saved to ${path} (${d.count()} elements)`;
  }
}
