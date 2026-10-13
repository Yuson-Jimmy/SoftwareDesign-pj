import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, parseNumber } from '../Command';

/** canvas [w] [h]：无参数显示画布尺寸；带参数修改尺寸（属文档类，执行后 undo/redo 禁止） */
export class CanvasCommand implements Command {
  readonly name = 'canvas';
  readonly usage = 'canvas [w] [h]';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length === 0) {
      return `canvas ${d.width}x${d.height}`;
    }
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const w = parseNumber(args[0], 'w');
    const h = parseNumber(args[1], 'h');
    if (w <= 0 || h <= 0) throw new CommandError('canvas size must be positive numbers');
    d.width = w;
    d.height = h;
    editor.markIo();
    return `canvas resized to ${w}x${h}`;
  }
}
