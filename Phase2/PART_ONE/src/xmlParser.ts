export interface SvgSyntaxElement {
  readonly tagName: string;
  readonly id?: string;
  readonly children: SvgSyntaxElement[];
  /** Offset of the opening '<'. */
  readonly start: number;
  /** Offset immediately after the opening tag's '>'. */
  readonly startTagEnd: number;
  /** Offset immediately after the closing tag (or '/>'). */
  readonly end: number;
}

export class XmlParseError extends SyntaxError {
  constructor(message: string, readonly offset: number) {
    super(`${message} at offset ${offset}`);
    this.name = 'XmlParseError';
  }
}

/**
 * Parses the XML subset needed by the SVG outline while retaining source offsets.
 * It intentionally performs syntax checks only, not SVG-specific validation.
 */
export function parseSvgSyntax(source: string): SvgSyntaxElement {
  let offset = 0;

  const fail = (message: string): never => {
    throw new XmlParseError(message, offset);
  };

  const skipWhitespace = (): void => {
    while (offset < source.length && /\s/.test(source[offset])) offset++;
  };

  const readName = (): string => {
    const match = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(source.slice(offset));
    if (!match) throw new XmlParseError('Expected an XML name', offset);
    offset += match[0].length;
    return match[0];
  };

  const skipDelimited = (delimiter: string, description: string): void => {
    const end = source.indexOf(delimiter, offset);
    if (end < 0) fail(`Unterminated ${description}`);
    offset = end + delimiter.length;
  };

  const skipDeclaration = (): void => {
    // Handles DOCTYPE declarations, including an internal subset and quoted '>'.
    let cursor = offset + 2;
    let subsetDepth = 0;
    let quote = '';
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '[') {
        subsetDepth++;
      } else if (char === ']') {
        subsetDepth = Math.max(0, subsetDepth - 1);
      } else if (char === '>' && subsetDepth === 0) {
        offset = cursor + 1;
        return;
      }
      cursor++;
    }
    fail('Unterminated declaration');
  };

  const skipMisc = (): void => {
    for (;;) {
      skipWhitespace();
      if (source.startsWith('<?', offset)) {
        offset += 2;
        skipDelimited('?>', 'processing instruction');
      } else if (source.startsWith('<!--', offset)) {
        offset += 4;
        skipDelimited('-->', 'comment');
      } else if (source.startsWith('<!', offset)) {
        skipDeclaration();
      } else {
        return;
      }
    }
  };

  const decodeEntities = (value: string): string =>
    value.replace(/&(?:#(\d+)|#x([\da-f]+)|lt|gt|quot|apos|amp);/gi, (entity, decimal, hex) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return (
        {
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&amp;': '&',
        }[entity.toLowerCase()] ?? entity
      );
    });

  const parseElement = (): SvgSyntaxElement => {
    const start = offset;
    if (source[offset] !== '<') fail("Expected '<'");
    offset++;
    const tagName = readName();
    const attributes: Record<string, string> = {};

    for (;;) {
      skipWhitespace();
      if (source.startsWith('/>', offset)) {
        offset += 2;
        return {
          tagName,
          id: attributes.id ? decodeEntities(attributes.id) : undefined,
          children: [],
          start,
          startTagEnd: offset,
          end: offset,
        };
      }
      if (source[offset] === '>') {
        offset++;
        break;
      }
      if (offset >= source.length) fail(`Unterminated opening tag <${tagName}>`);

      const attributeName = readName();
      skipWhitespace();
      if (source[offset] !== '=') fail(`Expected '=' after attribute ${attributeName}`);
      offset++;
      skipWhitespace();
      const quote = source[offset];
      if (quote !== '"' && quote !== "'") fail(`Attribute ${attributeName} must be quoted`);
      offset++;
      const valueStart = offset;
      const valueEnd = source.indexOf(quote, valueStart);
      if (valueEnd < 0) fail(`Unterminated attribute ${attributeName}`);
      attributes[attributeName] = source.slice(valueStart, valueEnd);
      offset = valueEnd + 1;
    }

    const startTagEnd = offset;
    const children: SvgSyntaxElement[] = [];
    for (;;) {
      if (offset >= source.length) fail(`Unterminated element <${tagName}>`);
      if (source.startsWith('</', offset)) {
        offset += 2;
        const closingName = readName();
        skipWhitespace();
        if (source[offset] !== '>') fail(`Expected '>' after </${closingName}`);
        offset++;
        if (closingName !== tagName) {
          fail(`Mismatched closing tag </${closingName}> for <${tagName}>`);
        }
        return {
          tagName,
          id: attributes.id ? decodeEntities(attributes.id) : undefined,
          children,
          start,
          startTagEnd,
          end: offset,
        };
      }
      if (source.startsWith('<!--', offset)) {
        offset += 4;
        skipDelimited('-->', 'comment');
      } else if (source.startsWith('<![CDATA[', offset)) {
        offset += 9;
        skipDelimited(']]>', 'CDATA section');
      } else if (source.startsWith('<?', offset)) {
        offset += 2;
        skipDelimited('?>', 'processing instruction');
      } else if (source.startsWith('<!', offset)) {
        skipDeclaration();
      } else if (source[offset] === '<') {
        children.push(parseElement());
      } else {
        const textEnd = source.indexOf('<', offset);
        offset = textEnd < 0 ? source.length : textEnd;
      }
    }
  };

  if (source.charCodeAt(0) === 0xfeff) offset = 1;
  skipMisc();
  if (offset >= source.length) fail('The document has no root element');
  const root = parseElement();
  skipMisc();
  if (offset !== source.length) fail('Unexpected content after the root element');
  return root;
}
