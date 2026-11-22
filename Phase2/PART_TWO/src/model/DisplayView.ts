import type { Document } from './Document';
import { Group } from './Group';
import { ModelError, Shape } from './Shape';
import type { TreeDecorator } from './TreeDecorator';

function mustFind(d: Document, id: string): Shape {
  const shape = d.find(id);
  if (!shape) throw new ModelError(`no such shape: ${id}`);
  return shape;
}

function nodeLine(shape: Shape, decorators: TreeDecorator[], width?: number): string {
  let label = shape.label;
  const geo = shape.geometrySummary();
  if (geo) label = width !== undefined ? label.padEnd(width) : label + '  ';
  const styleBits: string[] = [];
  if (shape.fill !== undefined) styleBits.push(`fill=${shape.fill}`);
  if (shape.stroke !== undefined) styleBits.push(`stroke=${shape.stroke}`);
  if (shape.strokeWidth !== undefined) styleBits.push(`stroke-width=${shape.strokeWidth}`);
  const detail = [geo, ...styleBits].filter((s) => s !== '').join(' ');
  const line = detail ? `${label}${detail}` : label;
  const decorations = decorators.flatMap((decorator) => decorator.decorations(shape));
  return decorations.length > 0 ? `${line} ${decorations.join(' ')}` : line;
}

function renderChildren(group: Group, prefix: string, lines: string[], decorators: TreeDecorator[]): void {
  const kids = group.children;
  if (kids.length === 0) return;
  const width = Math.max(...kids.map((k) => k.label.length)) + 2;
  kids.forEach((child, i) => {
    const last = i === kids.length - 1;
    lines.push(prefix + (last ? '└── ' : '├── ') + nodeLine(child, decorators, width));
    if (child instanceof Group) renderChildren(child, prefix + (last ? '    ' : '│   '), lines, decorators);
  });
}

/** 内核只负责遍历，行尾标签完全由 TreeDecorator 插件提供。 */
export function renderTree(d: Document, id?: string, decorators: TreeDecorator[] = []): string {
  if (id !== undefined) {
    const shape = mustFind(d, id);
    const lines = [nodeLine(shape, decorators)];
    if (shape instanceof Group) renderChildren(shape, '', lines, decorators);
    return lines.join('\n');
  }

  const rootLine = `svg (${d.width}x${d.height})`;
  const rootDecorations = decorators.flatMap((decorator) => decorator.decorations(d.root));
  const lines = [rootDecorations.length > 0 ? `${rootLine} ${rootDecorations.join(' ')}` : rootLine];
  renderChildren(d.root, '', lines, decorators);
  return lines.join('\n');
}

export function renderShape(d: Document, id: string): string {
  const shape = mustFind(d, id);
  const lines = [`${shape.label}  parent=${d.parentLabel(shape)}`];
  const geo = shape.geometryDetail();
  if (geo) lines.push(`  ${geo}`);
  for (const line of shape.styleDetailLines()) lines.push(`  ${line}`);
  return lines.join('\n');
}
