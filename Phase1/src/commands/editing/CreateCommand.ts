import type { Editor } from '../../editor/Editor';
import { Group } from '../../model/Group';
import type { ShapeFactory } from '../../model/ShapeFactory';
import { Command, CommandError, doc, rethrow } from '../Command';

/**
 * create <type> <id> [params…] [in <containerId>]
 * in 子句只认倒数第二位是 in 的尾缀形式，避免与 text 内容撞车。
 */
export class CreateCommand implements Command {
  readonly name = 'create';
  readonly usage = 'create <type> <id> [params…] [in <containerId>]';

  constructor(private readonly factory: ShapeFactory) {}

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length < 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const [type, id] = args;

    if (!this.factory.has(type)) {
      throw new CommandError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    if (d.has(id)) {
      throw new CommandError(`id already exists: ${id}`);
    }

    let params = args.slice(2);
    let container: Group | null = null;
    if (params.length >= 2 && params[params.length - 2] === 'in') {
      const containerId = params[params.length - 1];
      params = params.slice(0, -2);
      const target = d.find(containerId);
      if (!target) throw new CommandError(`no such container: ${containerId}`);
      if (!(target instanceof Group)) throw new CommandError(`not a container: ${containerId}`);
      container = target;
    }

    let shape;
    try {
      shape = this.factory.create(type, id, params);
    } catch (err) {
      rethrow(err);
    }

    d.attach(shape, container);
    const message = container
      ? `${shape.label} created in ${container.label}`
      : `${shape.label} created`;

    editor.pushHistory({
      undo: () => {
        d.detach(shape);
        return `${shape.label} removed`;
      },
      redo: () => {
        d.attach(shape, container);
        return message;
      },
    });
    return message;
  }
}
