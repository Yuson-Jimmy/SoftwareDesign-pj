import type { Editor } from '../../editor/Editor';
import { Command, CommandError, doc, mustFind } from '../Command';

/** front <id> / back <id>：同级 z-order 调到最前（最后绘制）/ 最后（最先绘制） */
export class FrontBackCommand implements Command {
  readonly usage = 'front <id> / back <id>';

  constructor(readonly name: 'front' | 'back') {}

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length !== 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const shape = mustFind(d, args[0]);
    const parent = shape.parent ?? d.root;
    const oldIndex = parent.indexOf(shape);

    const apply = (): void => {
      parent.remove(shape);
      if (this.name === 'front') {
        parent.insert(shape);
      } else {
        parent.insert(shape, 0);
      }
    };
    const revert = (): void => {
      parent.remove(shape);
      parent.insert(shape, oldIndex);
    };

    apply();
    const message = `${shape.label} moved to ${this.name}`;
    editor.pushHistory({
      undo: () => {
        revert();
        return `${shape.label} z-order restored`;
      },
      redo: () => {
        apply();
        return message;
      },
    });
    return message;
  }
}
