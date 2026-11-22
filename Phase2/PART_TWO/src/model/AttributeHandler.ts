import { ModelError, Shape } from './Shape';

/** 属性扩展点：为特定图形类型补充 get/set/clear 的完整撤销语义。 */
export interface AttributeHandler {
  readonly shapeType: string;
  readonly attribute: string;
  get(shape: Shape): string | undefined;
  set(shape: Shape, value: string): void;
  clear(shape: Shape): void;
}

export class AttributeRegistry {
  private readonly handlers = new Map<string, AttributeHandler>();

  register(handler: AttributeHandler): void {
    const key = `${handler.shapeType}.${handler.attribute}`;
    if (this.handlers.has(key)) throw new ModelError(`attribute handler already registered: ${key}`);
    this.handlers.set(key, handler);
  }

  private resolve(shape: Shape, attribute: string): AttributeHandler | undefined {
    return this.handlers.get(`${shape.type}.${attribute}`);
  }

  get(shape: Shape, attribute: string): string | undefined {
    const handler = this.resolve(shape, attribute);
    return handler ? handler.get(shape) : this.fallbackGet(shape, attribute);
  }

  set(shape: Shape, attribute: string, value: string): void {
    const handler = this.resolve(shape, attribute);
    if (handler) handler.set(shape, value);
    else shape.setAttribute(attribute, value);
  }

  clear(shape: Shape, attribute: string): void {
    const handler = this.resolve(shape, attribute);
    if (handler) handler.clear(shape);
    else shape.clearAttribute(attribute);
  }

  /** undefined 是合法的旧值，因此不能用 ?? 直接回退到内核实现。 */
  private fallbackGet(shape: Shape, attribute: string): string | undefined {
    return shape.getAttribute(attribute);
  }
}
