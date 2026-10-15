import type { CommandsExecutor } from '../../commands_executor/CommandsExecutor';
import { Command, CommandError, doc, parseNumber, rethrow } from '../Command';

/** canvas [w] [h]：无参数显示画布尺寸；带参数修改尺寸（属文档类，执行后 undo/redo 禁止） */
export class CanvasCommand implements Command {
  readonly name = 'canvas';
  readonly usage = 'canvas [w] [h]';

  execute(executor: CommandsExecutor, args: string[]): string {
    doc(executor);
    if (args.length === 0) {
      try {
        return executor.canvasSize();
      } catch (err) {
        return rethrow(err);
      }
    }
    if (args.length !== 2) throw new CommandError(`invalid arguments, usage: ${this.usage}`);
    const w = parseNumber(args[0], 'w');
    const h = parseNumber(args[1], 'h');
    try {
      return executor.resizeCanvas(w, h);
    } catch (err) {
      return rethrow(err);
    }
  }
}
