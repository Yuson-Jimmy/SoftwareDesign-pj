import type { SvgReader } from '../model/SvgReader';
import type { SvgWriter } from '../model/SvgWriter';
import type { ShapeFactory } from '../model/ShapeFactory';
import { Command, CommandError } from './Command';
import { HelpCommand } from './display/HelpCommand';
import { ShowCommand } from './display/ShowCommand';
import { TreeCommand } from './display/TreeCommand';
import { CanvasCommand } from './document/CanvasCommand';
import { InitCommand } from './document/InitCommand';
import { ReadCommand } from './document/ReadCommand';
import { SaveCommand } from './document/SaveCommand';
import { AddtoCommand } from './editing/AddtoCommand';
import { CreateCommand } from './editing/CreateCommand';
import { DeleteCommand } from './editing/DeleteCommand';
import { FrontBackCommand } from './editing/FrontBackCommand';
import { GroupCommand } from './editing/GroupCommand';
import { MoveCommand } from './editing/MoveCommand';
import { ScaleCommand } from './editing/ScaleCommand';
import { SetCommand } from './editing/SetCommand';
import { UngroupCommand } from './editing/UngroupCommand';
import { RedoCommand } from './RedoCommand';
import { UndoCommand } from './UndoCommand';

/**
 * 命令注册表：命令名 → 命令实例。
 * 全系统仅两处按名字分派之一（另一处是 ShapeFactory）。
 */
export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  resolve(name: string): Command {
    const command = this.commands.get(name);
    if (!command) throw new CommandError(`unknown command: ${name}`);
    return command;
  }

  catalog(): { name: string; usage: string }[] {
    return [...this.commands.values()].map((c) => ({ name: c.name, usage: c.usage }));
  }
}

export function createDefaultRegistry(deps: {
  factory: ShapeFactory;
  reader: SvgReader;
  writer: SvgWriter;
}): CommandRegistry {
  const registry = new CommandRegistry();

  // 文档类（执行后 undo/redo 禁止）
  registry.register(new InitCommand());
  registry.register(new ReadCommand(deps.reader));
  registry.register(new SaveCommand(deps.writer));
  registry.register(new CanvasCommand());

  // 图形编辑类（可 undo/redo）
  registry.register(new CreateCommand(deps.factory));
  registry.register(new DeleteCommand());
  registry.register(new MoveCommand());
  registry.register(new ScaleCommand());
  registry.register(new SetCommand());
  registry.register(new GroupCommand());
  registry.register(new UngroupCommand());
  registry.register(new AddtoCommand());
  registry.register(new FrontBackCommand('front'));
  registry.register(new FrontBackCommand('back'));

  // 显示类（不进 undo 栈）
  registry.register(new TreeCommand());
  registry.register(new ShowCommand());

  // 撤销重做
  registry.register(new UndoCommand());
  registry.register(new RedoCommand());

  // help 放在最后，能看到全部命令
  registry.register(new HelpCommand(() => registry.catalog()));

  return registry;
}
