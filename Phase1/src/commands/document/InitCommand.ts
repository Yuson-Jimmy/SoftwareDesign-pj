import type { Editor } from '../../editor/Editor';
import { Document } from '../../model/Document';
import { Command, CommandError } from '../Command';

/** init [w] [h]：新建空画布（默认 800×600），作为当前文档 */
export class InitCommand implements Command {
  readonly name = 'init';
  readonly usage = 'init [w] [h]';

  execute(editor: Editor, args: string[]): string {
    if (args.length !== 0 && args.length !== 2) {
      throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    }
    let w = 800;
    let h = 600;
    if (args.length === 2) {
      w = Number(args[0]);
      h = Number(args[1]);
      if (Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) {
        throw new CommandError('canvas size must be positive numbers');
      }
    }
    editor.setDocument(new Document(w, h), null);
    return `canvas ${w}x${h} created`;
  }
}
