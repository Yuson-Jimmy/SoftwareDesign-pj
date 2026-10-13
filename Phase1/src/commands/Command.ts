import type { Editor } from '../editor/Editor';
import { Document } from '../model/Document';
import { Group } from '../model/Group';
import { ModelError, Shape } from '../model/Shape';

/** 命令执行失败：message 不带 error: 前缀，由 cli 层统一包装 */
export class CommandError extends Error {}

/** 把 model 层错误转成命令错误（保持信息不变） */
export function rethrow(err: unknown): never {
  if (err instanceof ModelError) throw new CommandError(err.message);
  throw err;
}

/**
 * 命令接口：每个用户命令一个类。
 * execute 返回要给用户的输出（可多行），不自己打印；
 * 失败抛 CommandError，且必须不改变任何状态（先校验后动手）。
 */
export interface Command {
  readonly name: string;
  readonly usage: string;
  execute(editor: Editor, args: string[]): string;
}

/** 取文档（未 init/read 时报统一错误） */
export function doc(editor: Editor): Document {
  try {
    return editor.requireDocument();
  } catch (err) {
    return rethrow(err);
  }
}

/** 按 id 取图形，不存在报 no such shape */
export function mustFind(d: Document, id: string): Shape {
  const shape = d.find(id);
  if (!shape) throw new CommandError(`no such shape: ${id}`);
  return shape;
}

/** 按 id 取容器，区分「不存在」与「不是容器」 */
export function mustContainer(d: Document, id: string): Group {
  const shape = d.find(id);
  if (!shape) throw new CommandError(`no such container: ${id}`);
  if (!(shape instanceof Group)) throw new CommandError(`not a container: ${id}`);
  return shape;
}

export function parseNumber(raw: string, what: string): number {
  const n = Number(raw);
  if (raw.trim() === '' || Number.isNaN(n)) {
    throw new CommandError(`invalid number for ${what}: ${raw}`);
  }
  return n;
}

export function requireArgs(args: string[], n: number, usage: string): void {
  if (args.length !== n) throw new CommandError(`invalid arguments, usage: ${usage}`);
}

export function fmtNum(n: number): string {
  return String(n);
}

/** 移动类回显：有锚点的图形用绝对位置，line/g 用增量 */
export function movedMessage(shape: Shape, dx: number, dy: number, back: boolean): string {
  const anchor = shape.anchor();
  if (anchor) {
    return `${shape.label} moved ${back ? 'back ' : ''}to (${fmtNum(anchor[0])},${fmtNum(anchor[1])})`;
  }
  return `${shape.label} moved ${back ? 'back ' : ''}by (${fmtNum(dx)},${fmtNum(dy)})`;
}
