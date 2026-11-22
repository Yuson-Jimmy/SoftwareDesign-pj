import { ModelError, Shape } from './Shape';

/** 一次属性修改的完整逆操作；可封装多个子部件，整体构成一个 undo 单元。 */
export interface AttributeChange {
  undo(): void;
  redo(): void;
}

/** 属性扩展点：shapeType + attribute 是唯一键，apply 返回事务成功后的变更闭包。 */
export interface AttributeHandler {
  readonly shapeType: string;
  readonly attribute: string;
  apply(shape: Shape, value: string): AttributeChange;
}

export class AttributeRegistry {
  private readonly handlers = new Map<string, AttributeHandler>();

  register(handler: AttributeHandler): void {
    const key = `${handler.shapeType}.${handler.attribute}`;
    if (this.handlers.has(key)) throw new ModelError(`attribute handler already registered: ${key}`);
    this.handlers.set(key, handler);
  }

  /** 返回 undefined 才允许走 Phase1 白名单；处理器抛错绝不降级重试。 */
  apply(shape: Shape, attribute: string, value: string): AttributeChange | undefined {
    return this.handlers.get(`${shape.type}.${attribute}`)?.apply(shape, value);
  }
}
