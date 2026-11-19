import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSvgSyntax, XmlParseError } from '../../xmlParser';

const nestedSvg = `<svg width="800" height="600">
  <g id="flow">
    <rect id="start" x="20" y="20" width="120" height="60"/>
    <g id="nested">
      <text x="30" y="50">Hello &amp; SVG</text>
    </g>
  </g>
</svg>`;

test('retains nested groups, leaves, ids, and source order', () => {
  const root = parseSvgSyntax(nestedSvg);
  assert.equal(root.tagName, 'svg');
  assert.equal(root.children.length, 1);
  const flow = root.children[0];
  assert.equal(flow.id, 'flow');
  assert.deepEqual(flow.children.map((child) => [child.tagName, child.id]), [
    ['rect', 'start'],
    ['g', 'nested'],
  ]);
  assert.equal(flow.children[1].children[0].tagName, 'text');
});

test('keeps elements without id and does not invent identifiers', () => {
  const root = parseSvgSyntax(nestedSvg);
  const text = root.children[0].children[1].children[0];
  assert.equal(text.id, undefined);
  assert.equal(text.children.length, 0);
});

test('records whole-element and opening-tag offsets for source navigation', () => {
  const source = '<svg>\n  <rect id="start" x="20"/>\n</svg>';
  const rect = parseSvgSyntax(source).children[0];
  assert.equal(source.slice(rect.start, rect.startTagEnd), '<rect id="start" x="20"/>');
  assert.equal(source.slice(rect.start, rect.end), '<rect id="start" x="20"/>');
  assert.ok(rect.startTagEnd <= rect.end);
});

test('reflects edited content when the new text is parsed again', () => {
  const before = parseSvgSyntax('<svg><g id="old"><rect/></g></svg>');
  const after = parseSvgSyntax('<svg><g id="new"><rect id="changed"/><circle/></g></svg>');
  assert.equal(before.children[0].id, 'old');
  assert.equal(after.children[0].id, 'new');
  assert.deepEqual(after.children[0].children.map((child) => child.id), ['changed', undefined]);
});

test('supports XML declarations, comments, CDATA, entities, and single quotes', () => {
  const root = parseSvgSyntax(`<?xml version="1.0"?>
<!-- before --><svg id='root&amp;1'><!-- inside --><text><![CDATA[a < b]]></text></svg>`);
  assert.equal(root.id, 'root&1');
  assert.equal(root.children[0].tagName, 'text');
});

test('rejects incomplete or mismatched XML with a bounded parse error', () => {
  const invalidDocuments = [
    '',
    '<svg>',
    '<svg><g></svg>',
    '<svg><rect id="unterminated></rect></svg>',
    '<svg><!-- unfinished</svg>',
    '<svg/><!-- trailing --><svg/>',
  ];
  for (const source of invalidDocuments) {
    assert.throws(() => parseSvgSyntax(source), XmlParseError, source);
  }
});
