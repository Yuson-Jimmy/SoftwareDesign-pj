import * as readline from 'node:readline';
import { Application, createDefaultApplication } from '../app/Application';
import { CommandError } from '../commands/Command';
import { CommandRegistry } from '../commands/CommandRegistry';
import { CommandsExecutor } from '../commands_executor/CommandsExecutor';
import { Messages } from './Messages';
import { ParseError, parseLine } from './Parser';

/** REPL 只负责交互；全部插件在 Application 的唯一装配点注册。 */
export class Repl {
  private readonly executor: CommandsExecutor;
  private readonly registry: CommandRegistry;

  constructor(application: Application = createDefaultApplication()) {
    this.executor = application.executor;
    this.registry = application.registry;
  }

  /** 执行一行，返回要打印的输出（null 表示无输出：空行/注释） */
  handleLine(line: string): string | null {
    let tokens: string[] | null;
    try {
      tokens = parseLine(line);
    } catch (err) {
      if (err instanceof ParseError) return Messages.error(err.message);
      throw err;
    }
    if (!tokens) return null;

    const [name, ...args] = tokens;
    try {
      const command = this.registry.resolve(name);
      return Messages.result(command.execute(this.executor, args));
    } catch (err) {
      if (err instanceof CommandError) return Messages.error(err.message);
      throw err;
    }
  }

  run(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: Messages.prompt,
    });
    console.log(Messages.banner);
    console.log();
    rl.prompt();
    rl.on('line', (line) => {
      const output = this.handleLine(line);
      if (output !== null) console.log(output);
      rl.prompt();
    });
    rl.on('close', () => process.exit(0));
  }
}

if (require.main === module) {
  new Repl().run();
}
