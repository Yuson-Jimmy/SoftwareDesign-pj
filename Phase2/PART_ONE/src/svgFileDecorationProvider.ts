import * as vscode from 'vscode';

/** Adds presentation-only metadata; it never renames or edits a resource. */
export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  async provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): Promise<vscode.FileDecoration | undefined> {
    if (!/\.svg$/i.test(uri.path)) return undefined;

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (token.isCancellationRequested || (stat.type & vscode.FileType.Directory) !== 0) {
        return undefined;
      }
      return new vscode.FileDecoration('[]', 'SVG 文件');
    } catch {
      // Missing or inaccessible resources simply receive no decoration.
      return undefined;
    }
  }
}
