import type { Editor } from '../../editor/Editor';
import { Group } from '../../model/Group';
import { Shape } from '../../model/Shape';
import { Command, CommandError, doc, mustFind } from '../Command';

interface Slot {
  shape: Shape;
  parent: Group;
  index: number;
}

/**
 * group <newGid> <id1> <id2>…：
 * 新建容器并收入若干已有图形（从各自原父容器摘出，保持给定顺序）。
 * 容器本身插入到第一个图形的原位置。
 */
export class GroupCommand implements Command {
  readonly name = 'group';
  readonly usage = 'group <newGid> <id1> <id2>…';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length < 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const [gid, ...ids] = args;

    if (d.has(gid)) throw new CommandError(`id already exists: ${gid}`);
    const targets = ids.map((id) => mustFind(d, id));

    // 目标列表不得同时包含某容器与其子孙
    for (const a of targets) {
      for (const b of targets) {
        if (a !== b && d.isAncestor(a, b)) {
          throw new CommandError(`cannot group a container into its own descendant: ${a.id}`);
        }
      }
    }

    // 先记录全部原始位置，再动手
    const slots: Slot[] = targets.map((shape) => ({
      shape,
      parent: shape.parent ?? d.root,
      index: (shape.parent ?? d.root).indexOf(shape),
    }));
    const anchor = slots[0];

    const group = new Group(gid);
    d.attach(group, anchor.parent, anchor.index);
    for (const slot of slots) {
      d.reparent(slot.shape, group);
    }

    const message = `${group.label} created with ${slots.length} children`;
    editor.pushHistory({
      undo: () => {
        for (let i = slots.length - 1; i >= 0; i--) {
          d.reparent(slots[i].shape, slots[i].parent, slots[i].index);
        }
        d.detach(group);
        return `${group.label} dissolved, children restored`;
      },
      redo: () => {
        d.attach(group, anchor.parent, anchor.index);
        for (const slot of slots) {
          d.reparent(slot.shape, group);
        }
        return message;
      },
    });
    return message;
  }
}
