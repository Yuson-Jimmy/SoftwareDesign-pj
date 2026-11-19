import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

const captureDirectory = process.env.SVG_CAPTURE_DIR;
const projectRoot = path.resolve(__dirname, '../../../..');
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (!fs.existsSync(filePath)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${filePath}`);
    await delay(100);
  }
}

// This opt-in scenario keeps the real Extension Development Host in two visual
// states while an external desktop capture saves the required documentation.
(captureDirectory ? test : test.skip)('capture Explorer badge and native Outline demonstrations', async function () {
  this.timeout(150_000);
  const signals = captureDirectory!;

  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  const plain = await vscode.workspace.openTextDocument(path.join(projectRoot, 'fixtures', 'plain.txt'));
  await vscode.window.showTextDocument(plain);
  await vscode.commands.executeCommand('workbench.view.explorer');
  await vscode.commands.executeCommand('workbench.explorer.fileView.focus');
  await delay(2500);
  fs.writeFileSync(path.join(signals, 'badge.ready'), 'ready');
  await waitForFile(path.join(signals, 'badge.done'));

  const svg = await vscode.workspace.openTextDocument(path.join(projectRoot, 'fixtures', 'example.svg'));
  const editor = await vscode.window.showTextDocument(svg, { preview: false });
  await vscode.commands.executeCommand('workbench.view.explorer');
  await vscode.commands.executeCommand('outline.resetViewLocation');
  await vscode.commands.executeCommand('outline.toggleVisibility');
  await vscode.commands.executeCommand('workbench.action.openView', 'outline');
  await vscode.commands.executeCommand('outline.expandAll').then(undefined, () => undefined);

  // Select the opening tag; the native Outline follows the editor cursor.
  const rectStart = svg.getText().indexOf('<rect');
  if (rectStart >= 0) {
    const start = svg.positionAt(rectStart);
    const end = svg.positionAt(svg.getText().indexOf('/>', rectStart) + 2);
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
  await vscode.commands.executeCommand('outline.focus');
  await delay(2000);
  fs.writeFileSync(path.join(signals, 'outline.ready'), 'ready');
  await waitForFile(path.join(signals, 'outline.done'));
});
