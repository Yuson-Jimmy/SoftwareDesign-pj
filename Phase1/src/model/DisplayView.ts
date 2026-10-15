import type { Document } from './Document';
import { Group } from './Group';
import { ModelError, Shape } from './Shape';

/**
 * 显示视图：tree / show 两条显示指令的渲染器。
 *
 * 渲染需要 Shape/Group 的类型信息（instanceof、label、geometrySummary 等），
 * 因此它属于模型层——命令层只拿渲染好的字符串，不认识任何图形类。
 */

/** 按 id 取图形，不存在报 no such shape */
function mustFind(d: Document, id: string): Shape {
  const shape = d.find(id);
  if (!shape) throw new ModelError(`no such shape: ${id}`);
  return shape;
}

function nodeLine(shape: Shape, width?: number): string {
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

function renderChildren(group: Group, prefix: string, lines: string[]): void {
  const kids = group.children;
  if (kids.length === 0) return;
  // 同级内对齐几何列：标签列宽 = 同级最长标签 + 2
  const width = Math.max(...kids.map((k) => k.label.length)) + 2;
  kids.forEach((child, i) => {
    const last = i === kids.length - 1;
    lines.push(prefix + (last ? '└── ' : '├── ') + nodeLine(child, width));
    if (child instanceof Group) {
      renderChildren(child, prefix + (last ? '    ' : '│   '), lines);
    }
  });
}

/** tree [id]：结构树，内联关键几何属性 */
export function renderTree(d: Document, id?: string): string {
  if (id !== undefined) {
    // 子树：首行是图形自身（无分支符），下面照常展开
    const shape = mustFind(d, id);
    const lines = [nodeLine(shape)];
    if (shape instanceof Group) renderChildren(shape, '', lines);
    return lines.join('\n');
  }

  const lines = [`svg (${d.width}x${d.height})`];
  renderChildren(d.root, '', lines);
  return lines.join('\n');
}

/** show <id>：单个图形的属性明细 */
export function renderShape(d: Document, id: string): string {
  const shape = mustFind(d, id);
  const lines = [`${shape.label}  parent=${d.parentLabel(shape)}`];
  const geo = shape.geometryDetail();
  if (geo) lines.push(`  ${geo}`);
  for (const line of shape.styleDetailLines()) {
    lines.push(`  ${line}`);
  }
  return lines.join('\n');
}
