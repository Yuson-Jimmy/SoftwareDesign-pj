import type { EditOutcome } from '../model/EditOutcome';
import type { EditorModel } from '../model/EditorModel';
import { ModelError } from '../model/Shape';

/**
 * 命令执行器：commands 层与 model 层之间的唯一通道。
 *
 * 职责：
 * - 把 commands 解析好的调用转发给 model 中封装的「指令」；
 * - 维护 undo/redo 双栈：编辑类指令执行成功后把 EditOutcome 登记为一个 undo 单元；
 * - 文档类指令（init/read/save/resizeCanvas）执行后清空或封锁历史
 *   （报 "undo not allowed after io command"），直到下一次编辑指令解禁；
 * - undo / redo 作为「操作」在这里实现——它们不是 model 的指令，
 *   而是对历史栈的操作。
 *
 * 执行器不认识 Command 类，也不知道命令名（命令名分派只在 CommandRegistry）。
 */
export class CommandsExecutor {
  private readonly undoStack: EditOutcome[] = [];
  private readonly redoStack: EditOutcome[] = [];
  /** 文档类指令执行后置位，下一次编辑指令解除 */
  private ioBlocked = false;

  constructor(private readonly model: EditorModel) {}

  // ---------- 文档类指令：执行后 undo/redo 禁止 ----------

  init(width: number, height: number): string {
    const message = this.model.init(width, height);
    this.resetHistory();
    return message;
  }

  read(path: string): string {
    const message = this.model.read(path);
    this.resetHistory();
    return message;
  }

  save(path?: string): string {
    const message = this.model.save(path);
    this.ioBlocked = true;
    return message;
  }

  resizeCanvas(width: number, height: number): string {
    const message = this.model.resizeCanvas(width, height);
    this.ioBlocked = true;
    return message;
  }

  // ---------- 编辑类指令：登记为一个 undo 单元 ----------

  create(type: string, id: string, params: string[], containerId?: string): string {
    return this.record(this.model.createShape(type, id, params, containerId));
  }

  deleteShape(id: string): string {
    return this.record(this.model.deleteShape(id));
  }

  move(id: string, dxRaw: string, dyRaw: string): string {
    return this.record(this.model.moveShape(id, dxRaw, dyRaw));
  }

  scale(id: string, factorRaw: string): string {
    return this.record(this.model.scaleShape(id, factorRaw));
  }

  set(id: string, attr: string, value: string): string {
    return this.record(this.model.setShapeAttribute(id, attr, value));
  }

  group(gid: string, ids: string[]): string {
    return this.record(this.model.groupShapes(gid, ids));
  }

  ungroup(gid: string): string {
    return this.record(this.model.ungroupShape(gid));
  }

  addTo(gid: string, id: string): string {
    return this.record(this.model.addToGroup(gid, id));
  }

  front(id: string): string {
    return this.record(this.model.reorder(id, 'front'));
  }

  back(id: string): string {
    return this.record(this.model.reorder(id, 'back'));
  }

  // ---------- 撤销 / 重做「操作」 ----------

  /** undo：弹出最近一个 undo 单元并执行其逆操作 */
  undo(): string {
    if (this.ioBlocked) {
      throw new ModelError('undo not allowed after io command');
    }
    const entry = this.undoStack.pop();
    if (!entry) {
      throw new ModelError('nothing to undo');
    }
    const message = entry.undo();
    this.redoStack.push(entry);
    return message;
  }

  /** redo：重做；undo 后若有新编辑，redo 栈已被 record 清空 */
  redo(): string {
    if (this.ioBlocked) {
      throw new ModelError('redo not allowed after io command');
    }
    const entry = this.redoStack.pop();
    if (!entry) {
      throw new ModelError('nothing to redo');
    }
    const message = entry.redo();
    this.undoStack.push(entry);
    return message;
  }

  // ---------- 显示类查询（只读，不进历史） ----------

  canvasSize(): string {
    return this.model.canvasSize();
  }

  /** tree [id]：结构树渲染（渲染在模型内完成，命令层只拿字符串） */
  tree(id?: string): string {
    return this.model.tree(id);
  }

  /** show <id>：单个图形的属性明细 */
  show(id: string): string {
    return this.model.show(id);
  }

  /**
   * 要求当前已有文档，否则抛出模型的统一错误
   * （"no document. use 'init' or 'read' first"）。
   * 命令层用它做前置检查以保持「no document 优先于 invalid arguments」，
   * 而无需接触 Document 类型。
   */
  requireDocument(): void {
    this.model.document();
  }

  // ---------- 内部 ----------

  /** 编辑指令执行成功后登记历史；解除 IO 禁止态；清空 redo 栈 */
  private record(outcome: EditOutcome): string {
    this.undoStack.push(outcome);
    this.redoStack.length = 0;
    this.ioBlocked = false;
    return outcome.message;
  }

  /** init/read：替换文档，历史清空，undo/redo 进入禁止态 */
  private resetHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.ioBlocked = true;
  }
}
