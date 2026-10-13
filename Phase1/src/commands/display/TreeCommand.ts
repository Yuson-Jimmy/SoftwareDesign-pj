import type { Editor } from '../../editor/Editor';
import { Group } from '../../model/Group';
import { Shape } from '../../model/Shape';
import { Command, CommandError, doc, mustFind } from '../Command';

/** tree [id]：结构树，内联关键几何属性 */
export class TreeCommand implements Command {
  readonly name = 'tree';
  readonly usage = 'tree [id]';

  execute(editor: Editor, args: string[]): string {
    const d = doc(editor);
    if (args.length > 1) throw new CommandError(`invalid arguments, usage: ${this.usage}`);

    if (args.length === 1) {
      // 子树：首行是图形自身（无分支符），下面照常展开
      const shape = mustFind(d, args[0]);
      const lines = [this.nodeLine(shape)];
      if (shape instanceof Group) this.renderChildren(shape, '', lines);
      return lines.join('\n');
    }

    const lines = [`svg (${d.width}x${d.height})`];
    this.renderChildren(d.root, '', lines);
    return lines.join('\n');
  }

  private renderChildren(group: Group, prefix: string, lines: string[]): void {
    const kids = group.children;
    if (kids.length === 0) return;
    // 同级内对齐几何列：标签列宽 = 同级最长标签 + 2
    const width = Math.max(...kids.map((k) => k.label.length)) + 2;
    kids.forEach((child, i) => {
      const last = i === kids.length - 1;
      lines.push(prefix + (last ? '└── ' : '├── ') + this.nodeLine(child, width));
      if (child instanceof Group) {
        this.renderChildren(child, prefix + (last ? '    ' : '│   '), lines);
      }
    });
  }

  private nodeLine(shape: Shape, width?: number): string {
    let label = shape.label;
    const geo = shape.geometrySummary();
    if (geo) {
      label = width !== undefined ? label.padEnd(width) : label + '  ';
    }
    const styleBits: string[] = [];
    if (shape.fill !== undefined) styleBits.push(`fill=${shape.fill}`);
    if (shape.stroke !== undefined) styleBits.push(`stroke=${shape.stroke}`);
    if (shape.strokeWidth !== undefined) styleBits.push(`stroke-width=${shape.strokeWidth}`);
    const detail = [geo, ...styleBits].filter((s) => s !== '').join(' ');
    return detail ? `${label}${detail}` : label;
  }
}
