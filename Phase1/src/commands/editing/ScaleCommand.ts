import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, fmtNum, mustFind, parseNumber } from '../Command';

/** scale <id> <factor>：等比缩放全部几何属性；容器递归到每个子孙 */
export class ScaleCommand implements Command {
  readonly name = 'scale';
  readonly usage = 'scale <id> <factor>';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);
    const factor = parseNumber(args[1], 'factor');
    if (factor <= 0) throw new CommandError('scale factor must be positive');

    shape.scale(factor);
    const inverse = 1 / factor;

    editor.pushHistory({
      undo: () => {
        shape.scale(inverse);
        return `${shape.label} scaled back by ${fmtNum(inverse)}`;
      },
      redo: () => {
        shape.scale(factor);
        return `${shape.label} scaled by ${fmtNum(factor)}`;
      },
    });
    return `${shape.label} scaled by ${fmtNum(factor)}`;
  }
}
