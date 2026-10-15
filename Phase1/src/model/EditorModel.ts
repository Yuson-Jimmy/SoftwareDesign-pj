import { Document } from './Document';
import type { EditOutcome } from './EditOutcome';
import { Group } from './Group';
import { ModelError, Shape } from './Shape';
import { createDefaultFactory, ShapeFactory } from './ShapeFactory';
import { SvgReader } from './SvgReader';
import { SvgWriter } from './SvgWriter';

/** 按 id 取图形，不存在报 no such shape */
function mustFind(d: Document, id: string): Shape {
  const shape = d.find(id);
  if (!shape) throw new ModelError(`no such shape: ${id}`);
  return shape;
}

/** 按 id 取容器，区分「不存在」与「不是容器」 */
function mustContainer(d: Document, id: string): Group {
  const shape = d.find(id);
  if (!shape) throw new ModelError(`no such container: ${id}`);
  if (!(shape instanceof Group)) throw new ModelError(`not a container: ${id}`);
  return shape;
}

/** 移动类回显：有锚点的图形用绝对位置，line/g 用增量 */
function movedMessage(shape: Shape, dx: number, dy: number, back: boolean): string {
  const anchor = shape.anchor();
  if (anchor) {
    return `${shape.label} moved ${back ? 'back ' : ''}to (${anchor[0]},${anchor[1]})`;
  }
  return `${shape.label} moved ${back ? 'back ' : ''}by (${dx},${dy})`;
}

interface Slot {
  shape: Shape;
  parent: Group;
  index: number;
}

/**
 * 编辑器模型：原 editor（会话状态）与 io（SVG 读写）合并而成，
 * 并把全部「指令」封装在这里——
 *
 * - 文档类指令：init / read / save / resizeCanvas（执行后 undo/redo 禁止，由执行器负责封锁）
 * - 编辑类指令：createShape / deleteShape / moveShape / scaleShape / setShapeAttribute /
 *   groupShapes / ungroupShape / addToGroup / reorder，均返回 EditOutcome（回显 + 逆操作闭包）
 * - 查询：document / hasDocument / canvasSize（显示类命令只读）
 *
 * 模型不认识 Command、不认识历史栈：undo/redo「操作」由 commands_executor 实现。
 */
export class EditorModel {
  private doc: Document | null = null;
  private sourcePath: string | null = null;
  private readonly factory: ShapeFactory;
  private readonly reader: SvgReader;
  private readonly writer = new SvgWriter();

  constructor(factory?: ShapeFactory) {
    this.factory = factory ?? createDefaultFactory();
    this.reader = new SvgReader(this.factory);
  }

  // ---------- 查询 ----------

  /** 取当前文档；未 init/read 时按约定报错 */
  document(): Document {
    if (!this.doc) {
      throw new ModelError("no document. use 'init' or 'read' first");
    }
    return this.doc;
  }

  get hasDocument(): boolean {
    return this.doc !== null;
  }

  /** 画布尺寸查询（canvas 无参数） */
  canvasSize(): string {
    const d = this.document();
    return `canvas ${d.width}x${d.height}`;
  }

  // ---------- 文档类指令（执行后 undo/redo 禁止） ----------

  /** init [w] [h]：新建空画布，作为当前文档 */
  init(width: number, height: number): string {
    if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
      throw new ModelError('canvas size must be positive numbers');
    }
    this.doc = new Document(width, height);
    this.sourcePath = null;
    return `canvas ${width}x${height} created`;
  }

  /** read <file.svg>：读入 SVG 为当前文档；缺 id 自动补并逐条警告 */
  read(path: string): string {
    const { doc, warnings } = this.reader.readFile(path);
    this.doc = doc;
    this.sourcePath = path;
    return [...warnings, `read ${path} (${doc.count()} elements)`].join('\n');
  }

  /** save [file.svg]：保存当前文档；无参数时保存到读入时的路径 */
  save(path?: string): string {
    const d = this.document();
    const target = path ?? this.sourcePath;
    if (!target) throw new ModelError('no file specified and no source path');
    this.writer.writeFile(d, target);
    return `saved to ${target} (${d.count()} elements)`;
  }

  /** canvas <w> <h>：修改画布尺寸（属文档类） */
  resizeCanvas(width: number, height: number): string {
    const d = this.document();
    if (width <= 0 || height <= 0) throw new ModelError('canvas size must be positive numbers');
    d.width = width;
    d.height = height;
    return `canvas resized to ${width}x${height}`;
  }

  // ---------- 编辑类指令（可 undo/redo，一条指令 = 一个 undo 单元） ----------

  /** create <type> <id> [params…] [in <containerId>] */
  createShape(type: string, id: string, params: string[], containerId?: string): EditOutcome {
    const d = this.document();
    if (!this.factory.has(type)) {
      throw new ModelError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    if (d.has(id)) {
      throw new ModelError(`id already exists: ${id}`);
    }

    let container: Group | null = null;
    if (containerId !== undefined) {
      const target = d.find(containerId);
      if (!target) throw new ModelError(`no such container: ${containerId}`);
      if (!(target instanceof Group)) throw new ModelError(`not a container: ${containerId}`);
      container = target;
    }

    const shape = this.factory.create(type, id, params);
    d.attach(shape, container);
    const message = container
      ? `${shape.label} created in ${container.label}`
      : `${shape.label} created`;

    return {
      message,
      undo: () => {
        d.detach(shape);
        return `${shape.label} removed`;
      },
      redo: () => {
        d.attach(shape, container);
        return message;
      },
    };
  }

  /** delete <id>：容器连同全部子孙删除；一个 undo 单元还原 */
  deleteShape(id: string): EditOutcome {
    const d = this.document();
    const shape = mustFind(d, id);

    const { parent, index } = d.detach(shape);
    const parentLabel = parent === d.root ? 'svg' : parent.label;

    return {
      message: `${shape.label} deleted`,
      undo: () => {
        d.attach(shape, parent, index);
        return `${shape.label} restored into ${parentLabel}`;
      },
      redo: () => {
        d.detach(shape);
        return `${shape.label} deleted`;
      },
    };
  }

  /** move <id> <dx> <dy>：增量平移；容器整体平移 */
  moveShape(id: string, dx: number, dy: number): EditOutcome {
    const d = this.document();
    const shape = mustFind(d, id);

    shape.move(dx, dy);

    return {
      message: movedMessage(shape, dx, dy, false),
      undo: () => {
        shape.move(-dx, -dy);
        return movedMessage(shape, -dx, -dy, true);
      },
      redo: () => {
        shape.move(dx, dy);
        return movedMessage(shape, dx, dy, false);
      },
    };
  }

  /** scale <id> <factor>：等比缩放全部几何属性；容器递归到每个子孙 */
  scaleShape(id: string, factor: number): EditOutcome {
    const d = this.document();
    const shape = mustFind(d, id);
    if (factor <= 0) throw new ModelError('scale factor must be positive');

    shape.scale(factor);
    const inverse = 1 / factor;

    return {
      message: `${shape.label} scaled by ${factor}`,
      undo: () => {
        shape.scale(inverse);
        return `${shape.label} scaled back by ${inverse}`;
      },
      redo: () => {
        shape.scale(factor);
        return `${shape.label} scaled by ${factor}`;
      },
    };
  }

  /** set <id> <attr> <value>：白名单内的属性改写；记录旧值用于撤销 */
  setShapeAttribute(id: string, attr: string, value: string): EditOutcome {
    const d = this.document();
    const shape = mustFind(d, id);

    // 先取旧值：既做白名单校验（unknown attribute），又留撤销快照
    const oldValue = shape.getAttribute(attr);
    shape.setAttribute(attr, value);

    const message = `${shape.label} updated: ${attr}="${value}"`;
    const undoMessage =
      oldValue === undefined
        ? `${shape.label} updated: ${attr} unset`
        : `${shape.label} updated: ${attr}="${oldValue}"`;

    return {
      message,
      undo: () => {
        if (oldValue === undefined) {
          shape.clearAttribute(attr);
        } else {
          shape.setAttribute(attr, oldValue);
        }
        return undoMessage;
      },
      redo: () => {
        shape.setAttribute(attr, value);
        return message;
      },
    };
  }

  /**
   * group <newGid> <id1> <id2>…：
   * 新建容器并收入若干已有图形（从各自原父容器摘出，保持给定顺序）。
   * 容器本身插入到第一个图形的原位置。
   */
  groupShapes(gid: string, ids: string[]): EditOutcome {
    const d = this.document();
    if (d.has(gid)) throw new ModelError(`id already exists: ${gid}`);
    const targets = ids.map((id) => mustFind(d, id));

    // 目标列表不得同时包含某容器与其子孙
    for (const a of targets) {
      for (const b of targets) {
        if (a !== b && d.isAncestor(a, b)) {
          throw new ModelError(`cannot group a container into its own descendant: ${a.id}`);
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
    return {
      message,
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
    };
  }

  /**
   * ungroup <gid>：解散容器，子图形提升到原容器的父级、占据原容器的位置。
   * 根级容器（svg 直接子节点）不允许解散。
   */
  ungroupShape(gid: string): EditOutcome {
    const d = this.document();
    const shape = mustFind(d, gid);
    if (!(shape instanceof Group)) throw new ModelError(`not a container: ${shape.id}`);
    const group = shape;
    const parent = group.parent ?? d.root;
    if (parent === d.root) {
      throw new ModelError(`cannot ungroup top-level container: ${group.id}`);
    }

    const index = parent.indexOf(group);
    const children = [...group.children];
    const parentLabel = parent.label;

    const apply = (): void => {
      d.detach(group);
      // 用 reparent 而不是直接 attach：先把子图形从 group 的 children 里摘干净
      for (let i = 0; i < children.length; i++) {
        d.reparent(children[i], parent, index + i);
      }
    };
    const revert = (): void => {
      d.attach(group, parent, index);
      for (const child of children) {
        d.reparent(child, group);
      }
    };

    apply();
    const message = `${group.label} ungrouped, ${children.length} children moved into ${parentLabel}`;
    return {
      message,
      undo: () => {
        revert();
        return `${group.label} restored with ${children.length} children`;
      },
      redo: () => {
        apply();
        return message;
      },
    };
  }

  /** addto <gid> <id>：把已有图形移入容器（作为最后一个子节点） */
  addToGroup(gid: string, id: string): EditOutcome {
    const d = this.document();
    const group = mustContainer(d, gid);
    const shape = mustFind(d, id);

    if (shape === group || d.isAncestor(shape, group)) {
      throw new ModelError(`cannot group a container into its own descendant: ${shape.id}`);
    }

    const oldParent = shape.parent ?? d.root;
    const oldIndex = oldParent.indexOf(shape);
    const oldLabel = oldParent === d.root ? 'svg' : oldParent.label;

    d.reparent(shape, group);
    const message = `${shape.label} added to ${group.label}`;

    return {
      message,
      undo: () => {
        d.reparent(shape, oldParent, oldIndex);
        return `${shape.label} moved back to ${oldLabel}`;
      },
      redo: () => {
        d.reparent(shape, group);
        return message;
      },
    };
  }

  /** front <id> / back <id>：同级 z-order 调到最前（最后绘制）/ 最后（最先绘制） */
  reorder(id: string, where: 'front' | 'back'): EditOutcome {
    const d = this.document();
    const shape = mustFind(d, id);
    const parent = shape.parent ?? d.root;
    const oldIndex = parent.indexOf(shape);

    const apply = (): void => {
      parent.remove(shape);
      if (where === 'front') {
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
    const message = `${shape.label} moved to ${where}`;
    return {
      message,
      undo: () => {
        revert();
        return `${shape.label} z-order restored`;
      },
      redo: () => {
        apply();
        return message;
      },
    };
  }
}
