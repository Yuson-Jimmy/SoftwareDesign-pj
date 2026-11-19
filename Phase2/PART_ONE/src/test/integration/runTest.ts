import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    // A parent Electron tool may export this; VSCode must start as Electron,
    // not as Node, or the fixture directory is interpreted as a script.
    delete process.env.ELECTRON_RUN_AS_NODE;
    const extensionDevelopmentPath = path.resolve(__dirname, '../../..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH;
    await runTests({
      ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [path.join(extensionDevelopmentPath, 'fixtures'), '--disable-extensions', '--disable-gpu'],
    });
  } catch (error) {
    console.error('VSCode integration tests failed:', error);
    process.exit(1);
  }
}

void main();
