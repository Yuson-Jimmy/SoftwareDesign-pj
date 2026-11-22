import * as fs from 'node:fs';
import { Document } from './Document';
import { fmt, ModelError } from './Shape';

/** SVG 写出：Document → 文件。可直接在浏览器打开预览。 */
export class SvgWriter {
  serialize(doc: Document): string {
    const w = fmt(doc.width);
    const h = fmt(doc.height);
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    ];
    for (const child of doc.root.children) {
      lines.push(child.toSVG('  '));
    }
    lines.push('</svg>');
    return lines.join('\n') + '\n';
  }

  writeFile(doc: Document, path: string): void {
    try {
      fs.writeFileSync(path, this.serialize(doc), 'utf8');
    } catch {
      throw new ModelError(`cannot write file: ${path}`);
    }
  }
}
