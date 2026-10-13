import { Group } from './Group';
import { ModelError, Shape } from './Shape';

/**
 * 文档：画布尺寸 + 根容器 + id 注册表。
 * 根是一个匿名 Group（代表 <svg> 本身），不进入 id 注册表。
 */
export class Document {
  readonly root = new Group('');
  private readonly registry = new Map<string, Shape>();

  constructor(
    public width = 800,
    public height = 600,
  ) {}

  find(id: string): Shape | undefined {
    return this.registry.get(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  /** 挂载到 parent（null = 画布根），并注册整棵子树 */
  attach(shape: Shape, parent: Group | null, index?: number): void {
    const p = parent ?? this.root;
    this.assertAbsentDeep(shape);
    p.insert(shape, index);
    this.registerDeep(shape);
  }

  /** 从父容器摘下，并注销整棵子树 */
  detach(shape: Shape): { parent: Group; index: number } {
    if (!shape.parent) throw new ModelError(`shape not attached: ${shape.id}`);
    const parent = shape.parent;
    const index = parent.remove(shape);
    this.unregisterDeep(shape);
    return { parent, index };
  }

  /** 改挂到别的容器（id 不变，注册表先摘后挂） */
  reparent(shape: Shape, newParent: Group, index?: number): void {
    this.detach(shape);
    this.attach(shape, newParent, index);
  }

  private assertAbsentDeep(shape: Shape): void {
    for (const s of shape instanceof Group ? shape.walk() : [shape]) {
      if (s.id && this.registry.has(s.id)) {
        throw new ModelError(`id already exists: ${s.id}`);
      }
    }
  }

  private registerDeep(shape: Shape): void {
    for (const s of shape instanceof Group ? shape.walk() : [shape]) {
      if (s.id) this.registry.set(s.id, s);
    }
  }

  private unregisterDeep(shape: Shape): void {
    for (const s of shape instanceof Group ? shape.walk() : [shape]) {
      if (s.id) this.registry.delete(s.id);
    }
  }

  /** 元素总数（不含根） */
  count(): number {
    let n = 0;
    for (const _ of this.root.walk()) n++;
    return n - 1; // 排除 root 自身
  }

  /** shape 的父容器显示名：g#markers 或 svg */
  parentLabel(shape: Shape): string {
    if (!shape.parent || shape.parent === this.root) return 'svg';
    return shape.parent.label;
  }

  /** 判断 ancestor 是否为 shape 的祖先（不含自身） */
  isAncestor(ancestor: Shape, shape: Shape): boolean {
    let p = shape.parent;
    while (p) {
      if (p === ancestor) return true;
      p = p.parent;
    }
    return false;
  }
}
