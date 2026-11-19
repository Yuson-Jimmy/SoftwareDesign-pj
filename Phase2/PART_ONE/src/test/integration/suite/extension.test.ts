import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SvgDocumentSymbolProvider } from '../../../svgDocumentSymbolProvider';
import { SvgFileDecorationProvider } from '../../../svgFileDecorationProvider';

const extensionId = 'software-design-lab.svg-file-outline';
const projectRoot = path.resolve(__dirname, '../../../..');
const fixture = (name: string): vscode.Uri => vscode.Uri.file(path.join(projectRoot, 'fixtures', name));
const token = new vscode.CancellationTokenSource().token;

async function replaceAll(document: vscode.TextDocument, text: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
  assert.equal(await vscode.workspace.applyEdit(edit), true);
}

suite('SVG extension', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, 'The development extension must be discoverable');
    await extension.activate();
  });

  test('decorates SVG files only, including an extension-like directory check', async () => {
    const provider = new SvgFileDecorationProvider();
    const svg = await provider.provideFileDecoration(fixture('example.svg'), token);
    assert.equal(svg?.badge, '[]');
    assert.equal(await provider.provideFileDecoration(fixture('plain.txt'), token), undefined);
    assert.equal(await provider.provideFileDecoration(fixture('directory.svg'), token), undefined);
  });

  test('provides nested native symbols and source navigation ranges', async () => {
    const document = await vscode.workspace.openTextDocument(fixture('example.svg'));
    const symbols = new SvgDocumentSymbolProvider().provideDocumentSymbols(document, token);
    assert.equal(symbols.length, 1);
    assert.equal(symbols[0].name, 'svg');
    const flow = symbols[0].children[0];
    assert.equal(flow.name, 'g#flow');
    assert.deepEqual(flow.children.map((symbol) => symbol.name), ['rect#start', 'g#nested', 'circle#done']);
    assert.equal(flow.children[1].children[0].name, 'text');
    assert.equal(flow.children[0].selectionRange.start.line, 2);
    assert.equal(flow.children[0].selectionRange.start.character, 4);
  });

  test('is registered for .svg documents through VSCode', async () => {
    const document = await vscode.workspace.openTextDocument(fixture('example.svg'));
    await vscode.window.showTextDocument(document);
    const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      document.uri,
    );
    const labels = result.flatMap(function flatten(symbol: vscode.DocumentSymbol): string[] {
      return [symbol.name, ...symbol.children.flatMap(flatten)];
    });
    assert.ok(labels.includes('rect#start'));
    assert.ok(labels.includes('g#nested'));
  });

  test('reflects edits and safely clears the outline for incomplete XML', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'xml',
      content: '<svg><g id="before"><rect/></g></svg>',
    });
    const provider = new SvgDocumentSymbolProvider();
    assert.equal(provider.provideDocumentSymbols(document, token)[0].children[0].name, 'g#before');

    await replaceAll(document, '<svg><g id="after"><rect id="changed"/><text/></g></svg>');
    const updated = provider.provideDocumentSymbols(document, token);
    assert.equal(updated[0].children[0].name, 'g#after');
    assert.deepEqual(updated[0].children[0].children.map((symbol) => symbol.name), ['rect#changed', 'text']);

    await replaceAll(document, '<svg><g id="unfinished">');
    assert.doesNotThrow(() => provider.provideDocumentSymbols(document, token));
    assert.deepEqual(provider.provideDocumentSymbols(document, token), []);
  });
});
