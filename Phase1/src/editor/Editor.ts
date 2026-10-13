import { Document } from '../model/Document';
import { ModelError } from '../model/Shape';

/**
 * 一次可逆编辑留下的历史条目。
 * 命令层执行成功后把逆操作闭包推进来，Editor 不认识 Command 类，
 * 以此保持 editor 不依赖 commands 层。
 */
export interface HistoryEntry {
  /** 撤销并返回回显（如 "circle#c1 moved back to (100,100)"） */
  undo(): string;
  /** 重做并返回回显 */
  redo(): string;
}

/**
 * 编辑会话状态机：当前文档 + 来源路径 + undo/redo 双栈 + IO 后禁用规则。
 * 刻意保持薄：不碰命令解析、不碰 SVG 格式、不碰打印。
 */
export class Editor {
  private doc: Document | null = null;
  private sourcePath: string | null = null;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  /** 文档类命令（init/read/save/canvas 改尺寸）执行后置位，下一次编辑命令解除 */
  private ioBlocked = false;

  /** 取当前文档；未 init/read 时按约定报错 */
  requireDocument(): Document {
    if (!this.doc) {
      throw new ModelError("no document. use 'init' or 'read' first");
    }
    return this.doc;
  }

  get hasDocument(): boolean {
    return this.doc !== null;
  }

  get source(): string | null {
    return this.sourcePath;
  }

  /** 新建/读入文档：替换当前文档，历史清空，undo/redo 进入禁止态 */
  setDocument(doc: Document, sourcePath: string | null): void {
    this.doc = doc;
    this.sourcePath = sourcePath;
    this.undoStack = [];
    this.redoStack = [];
    this.ioBlocked = true;
  }

  /** save / canvas 改尺寸：不换文档，但同样触发 IO 禁止态 */
  markIo(): void {
    this.ioBlocked = true;
  }

  /** 编辑命令执行成功后登记历史；解除 IO 禁止态；清空 redo 栈 */
  pushHistory(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    this.redoStack = [];
    this.ioBlocked = false;
  }

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
}
