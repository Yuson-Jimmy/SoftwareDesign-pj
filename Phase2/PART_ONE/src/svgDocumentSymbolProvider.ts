import * as vscode from 'vscode';
import { parseSvgSyntax, type SvgSyntaxElement } from './xmlParser';

/** Converts the offset-based syntax tree into VSCode's native outline model. */
export class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    if (token.isCancellationRequested) return [];
    try {
      const root = parseSvgSyntax(document.getText());
      return token.isCancellationRequested ? [] : [this.toDocumentSymbol(root, document)];
    } catch {
      // Incomplete XML is normal while typing. An empty outline is preferable
      // to stale locations or an extension-host error.
      return [];
    }
  }

  private toDocumentSymbol(element: SvgSyntaxElement, document: vscode.TextDocument): vscode.DocumentSymbol {
    const name = element.id ? `${element.tagName}#${element.id}` : element.tagName;
    const localName = element.tagName.includes(':')
      ? element.tagName.slice(element.tagName.lastIndexOf(':') + 1)
      : element.tagName;
    const kind =
      localName === 'svg'
        ? vscode.SymbolKind.Namespace
        : localName === 'g' || element.children.length > 0
          ? vscode.SymbolKind.Class
          : vscode.SymbolKind.Field;
    const range = new vscode.Range(document.positionAt(element.start), document.positionAt(element.end));
    const selectionRange = new vscode.Range(
      document.positionAt(element.start),
      document.positionAt(element.startTagEnd),
    );
    const symbol = new vscode.DocumentSymbol(name, '', kind, range, selectionRange);
    symbol.children = element.children.map((child) => this.toDocumentSymbol(child, document));
    return symbol;
  }
}
