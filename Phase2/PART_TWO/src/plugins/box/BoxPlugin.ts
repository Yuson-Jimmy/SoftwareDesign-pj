import { Group } from '../../model/Group';
import { ModelError, parseNum, Shape } from '../../model/Shape';
import { Rect } from '../../model/shapes/Rect';
import { Text } from '../../model/shapes/Text';
import type { Plugin } from '../Plugin';

function need(args: string[]): void {
  if (args.length !== 5) {
    throw new ModelError('invalid arguments, usage: create box <id> <x> <y> <w> <h> "<标题>"');
  }
}

function numberAttr(attrs: Record<string, string>, key: string): number {
  const value = Number(attrs[key]);
  return Number.isFinite(value) ? value : 0;
}

/** box 是插件所有的复合容器；内部部件由模板创建，不允许 ungroup。 */
export class Box extends Group {
  override readonly composite = true;

  constructor(id: string, withDefaultParts = false, x = 0, y = 0, width = 0, height = 0, title = '') {
    super(id);
    if (withDefaultParts) {
      const rect = new Rect(`${id}-rect`, x, y, width, height);
      Object.defineProperty(rect, 'structuralPart', { value: true });
      rect.fill = '#4a90d9';
      this.insert(rect);
      const label = new Text(`${id}-label`, x + 20, y + 35, title);
      Object.defineProperty(label, 'structuralPart', { value: true });
      this.insert(label);
    }
  }

  override get type(): string {
    return 'box';
  }

  override get operationLabel(): string {
    return `box#${this.id}`;
  }

  override creationDetail(): string {
    return `(g#${this.id} + rect#${this.id}-rect + text#${this.id}-label)`;
  }

  get rect(): Rect {
    const rect = this.children.find((child): child is Rect => child instanceof Rect && child.id === `${this.id}-rect`);
    if (!rect) throw new ModelError(`invalid box: missing rect part: ${this.id}`);
    return rect;
  }

  get title(): Text {
    const text = this.children.find((child): child is Text => child instanceof Text && child.id === `${this.id}-label`);
    if (!text) throw new ModelError(`invalid box: missing label part: ${this.id}`);
    return text;
  }

  override toSVG(indent: string): string {
    const attrs = `${this.attrsString()} data-kind="box"`;
    if (this.children.length === 0) return `${indent}<g ${attrs}/>`;
    const inner = this.children.map((child) => child.toSVG(`${indent}  `)).join('\n');
    return `${indent}<g ${attrs}>\n${inner}\n${indent}</g>`;
  }
}

function requireBox(shape: Shape): Box {
  if (!(shape instanceof Box)) throw new ModelError(`not a box: ${shape.id}`);
  return shape;
}

export const boxPlugin: Plugin = {
  name: 'box',
  shapes: [{
    type: 'box',
    create(id, args) {
      need(args);
      return new Box(
        id,
        true,
        parseNum(args[0], 'x'),
        parseNum(args[1], 'y'),
        parseNum(args[2], 'w'),
        parseNum(args[3], 'h'),
        args[4],
      );
    },
    load(id) {
      return new Box(id);
    },
    validate(shape) {
      const box = requireBox(shape);
      Object.defineProperty(box.rect, 'structuralPart', { value: true });
      Object.defineProperty(box.title, 'structuralPart', { value: true });
    },
  }],
  attributes: [
    {
      shapeType: 'box',
      attribute: 'fill',
      apply(shape, value) {
        const box = requireBox(shape);
        const rect = box.rect;
        const previous = rect.fill;
        rect.fill = value;
        return {
          message: `${box.operationLabel} fill propagated to ${rect.id}`,
          undoMessage: `${box.operationLabel} fill restored`,
          undo: () => { rect.fill = previous; },
          redo: () => { rect.fill = value; },
        };
      },
    },
    {
      shapeType: 'box',
      attribute: 'label',
      apply(shape, value) {
        const box = requireBox(shape);
        const text = box.title;
        const previous = text.content;
        text.content = value;
        return {
          message: `${box.operationLabel} label updated: "${value}"`,
          undoMessage: `${box.operationLabel} label restored: "${previous}"`,
          undo: () => { text.content = previous; },
          redo: () => { text.content = value; },
        };
      },
    },
  ],
  treeDecorators: [{
    name: 'box',
    decorations: (shape) => shape.type === 'box' ? ['(box)'] : [],
  }],
};
