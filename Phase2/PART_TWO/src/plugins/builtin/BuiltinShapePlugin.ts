import { Group } from '../../model/Group';
import { ModelError, parseNum, Shape } from '../../model/Shape';
import { Circle } from '../../model/shapes/Circle';
import { Ellipse } from '../../model/shapes/Ellipse';
import { Line } from '../../model/shapes/Line';
import { Rect } from '../../model/shapes/Rect';
import { Text } from '../../model/shapes/Text';
import type { ShapeProvider } from '../../model/ShapeProvider';
import type { Plugin } from '../Plugin';

function need(args: string[], min: number, max: number, usage: string): void {
  if (args.length < min || args.length > max) throw new ModelError(`invalid arguments, usage: ${usage}`);
}

function numAttr(attrs: Record<string, string>, key: string): number {
  const raw = attrs[key];
  if (raw === undefined || raw.trim() === '') return 0;
  const value = Number(raw);
  return Number.isNaN(value) ? 0 : value;
}

function applyStyle(shape: Shape, attrs: Record<string, string>): void {
  if (attrs.fill !== undefined) shape.fill = attrs.fill;
  if (attrs.stroke !== undefined) shape.stroke = attrs.stroke;
  if (attrs['stroke-width'] !== undefined) shape.strokeWidth = attrs['stroke-width'];
}

export const builtinShapeProviders: ShapeProvider[] = [
  {
    type: 'rect',
    create(id, a) {
      need(a, 4, 5, 'create rect <id> <x> <y> <w> <h> [fill]');
      const shape = new Rect(id, parseNum(a[0], 'x'), parseNum(a[1], 'y'), parseNum(a[2], 'w'), parseNum(a[3], 'h'));
      if (a[4] !== undefined) shape.fill = a[4];
      return shape;
    },
    load(id, attrs) {
      const shape = new Rect(id, numAttr(attrs, 'x'), numAttr(attrs, 'y'), numAttr(attrs, 'width'), numAttr(attrs, 'height'));
      applyStyle(shape, attrs);
      return shape;
    },
  },
  {
    type: 'circle',
    create(id, a) {
      need(a, 3, 4, 'create circle <id> <cx> <cy> <r> [fill]');
      const shape = new Circle(id, parseNum(a[0], 'cx'), parseNum(a[1], 'cy'), parseNum(a[2], 'r'));
      if (a[3] !== undefined) shape.fill = a[3];
      return shape;
    },
    load(id, attrs) {
      const shape = new Circle(id, numAttr(attrs, 'cx'), numAttr(attrs, 'cy'), numAttr(attrs, 'r'));
      applyStyle(shape, attrs);
      return shape;
    },
  },
  {
    type: 'ellipse',
    create(id, a) {
      need(a, 4, 5, 'create ellipse <id> <cx> <cy> <rx> <ry> [fill]');
      const shape = new Ellipse(id, parseNum(a[0], 'cx'), parseNum(a[1], 'cy'), parseNum(a[2], 'rx'), parseNum(a[3], 'ry'));
      if (a[4] !== undefined) shape.fill = a[4];
      return shape;
    },
    load(id, attrs) {
      const shape = new Ellipse(id, numAttr(attrs, 'cx'), numAttr(attrs, 'cy'), numAttr(attrs, 'rx'), numAttr(attrs, 'ry'));
      applyStyle(shape, attrs);
      return shape;
    },
  },
  {
    type: 'line',
    create(id, a) {
      need(a, 4, 5, 'create line <id> <x1> <y1> <x2> <y2> [stroke]');
      const shape = new Line(id, parseNum(a[0], 'x1'), parseNum(a[1], 'y1'), parseNum(a[2], 'x2'), parseNum(a[3], 'y2'));
      if (a[4] !== undefined) shape.stroke = a[4];
      return shape;
    },
    load(id, attrs) {
      const shape = new Line(id, numAttr(attrs, 'x1'), numAttr(attrs, 'y1'), numAttr(attrs, 'x2'), numAttr(attrs, 'y2'));
      applyStyle(shape, attrs);
      return shape;
    },
  },
  {
    type: 'text',
    create(id, a) {
      need(a, 3, 3, 'create text <id> <x> <y> "content"');
      return new Text(id, parseNum(a[0], 'x'), parseNum(a[1], 'y'), a[2]);
    },
    load(id, attrs, text) {
      const shape = new Text(id, numAttr(attrs, 'x'), numAttr(attrs, 'y'), text);
      applyStyle(shape, attrs);
      return shape;
    },
  },
  {
    type: 'g',
    create(id, a) {
      need(a, 0, 0, 'create g <id>');
      return new Group(id);
    },
    load(id, attrs) {
      const shape = new Group(id);
      applyStyle(shape, attrs);
      return shape;
    },
  },
];

export const builtinShapePlugin: Plugin = {
  name: 'builtin-shapes',
  shapes: builtinShapeProviders,
};
