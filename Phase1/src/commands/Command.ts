import type { CommandsExecutor } from '../commands_executor/CommandsExecutor';

/** 命令执行失败：message 不带 error: 前缀，由 cli 层统一包装 */
export class CommandError extends Error {}

/**
 * 把执行器/模型抛出的领域错误转成命令错误（保持信息不变）。
 * 用 domainError 标记做结构化判别，不 import ModelError——
 * 命令层完全不依赖模型类；非领域错误（程序 bug）原样上抛。
 */
export function rethrow(err: unknown): never {
  if (err instanceof Error && (err as { domainError?: boolean }).domainError === true) {
    throw new CommandError(err.message);
  }
  throw err;
}

/**
 * 命令接口：每个用户命令一个类。
 * 命令层只做语法校验（参数个数、尾缀切分），领域规则由 model 中的指令负责；
 * execute 返回要给用户的输出（可多行），不自己打印；
 * 失败抛 CommandError，且必须不改变任何状态（先校验后动手）。
 */
export interface Command {
  readonly name: string;
  readonly usage: string;
  execute(executor: CommandsExecutor, args: string[]): string;
}

/**
 * 前置检查：要求已有文档（未 init/read 时报统一错误）。
 * 保持「no document 优先于 invalid arguments」的报错顺序，
 * 只经由执行器，不接触 Document 类型。
 */
export function requireDoc(executor: CommandsExecutor): void {
  try {
    executor.requireDocument();
  } catch (err) {
    rethrow(err);
  }
}

/** 数字解析（纯语法级：与文档状态无关的参数，如 canvas/init 的宽高） */
export function parseNumber(raw: string, what: string): number {
  const n = Number(raw);
  if (raw.trim() === '' || Number.isNaN(n)) {
    throw new CommandError(`invalid number for ${what}: ${raw}`);
  }
  return n;
}
