import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { createApplication } from '../app/Application';
import { Repl } from '../cli/Repl';
import { ModelError } from '../model/Shape';
import { Rect } from '../model/shapes/Rect';
import { Text } from '../model/shapes/Text';
import { SvgWriter } from '../model/SvgWriter';
import { boxPlugin } from '../plugins/box/BoxPlugin';
import type { Plugin } from '../plugins/Plugin';

/** 仅供 XML 读回的测试替身，不复用内置图形插件。 */
const readerPrimitives: Plugin = {
  name: 'box-test-reader-primitives',
  shapes: [
    {
      type: 'rect',
      create: () => { throw new Error('not needed'); },
      load: (id, attrs) => new Rect(id, Number(attrs.x), Number(attrs.y), Number(attrs.width), Number(attrs.height)),
    },
    {
      type: 'text',
      create: () => { throw new Error('not needed'); },
      load: (id, attrs, text) => new Text(id, Number(attrs.x), Number(attrs.y), text),
    },
  ],
};

function boxCli() {
  const application = createApplication([boxPlugin, readerPrimitives]);
  const repl = new Repl(application);
  return { application, repl, run: (line: string) => repl.handleLine(line) };
}

function fixture(name: string, source: string): string {
  const directory = path.resolve('.test-output', 'box');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name);
  fs.writeFileSync(file, source);
  return file;
}

test('box creates its two owned parts with exact derived ids and messages', () => {
  const { application, run } = boxCli();
  run('init');
  assert.equal(
    run('create box n1 120 100 160 60 "开始"'),
    'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)',
  );
  assert.equal(run('tree n1'), [
    'g#n1 (box)',
    '├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9',
    '└── text#n1-label  (140,135) "开始"',
  ].join('\n'));
  assert.equal(application.model.document().count(), 3);
});

test('box moves, nests, groups, deletes and restores as one composite', () => {
  const { application, run } = boxCli();
  run('init');
  run('create box n1 120 100 160 60 "开始"');
  assert.equal(run('create box n2 1 2 30 20 "nested" in n1'), 'box#n2 created in g#n1 (g#n2 + rect#n2-rect + text#n2-label)');
  assert.equal(run('move n1 0 100'), 'box#n1 moved by (0,100)');
  assert.match(run('show n1-rect') ?? '', /x=120 y=200/);
  assert.match(run('show n1-label') ?? '', /x=140 y=235/);
  assert.equal(run('ungroup n1'), 'error: cannot ungroup composite shape: n1');
  assert.equal(run('delete n1'), 'g#n1 deleted');
  assert.equal(application.model.document().count(), 0);
  run('undo');
  assert.equal(application.model.document().count(), 6);
  run('redo');
  assert.equal(application.model.document().count(), 0);
});

test('box fill and label handlers preserve exact domain messages and undo units', () => {
  const { run } = boxCli();
  run('init');
  run('create box n1 0 0 100 50 "old"');
  assert.equal(run('set n1 fill #f5a623'), 'box#n1 fill propagated to n1-rect');
  assert.equal(run('set n1 label "处理数据 v2"'), 'box#n1 label updated: "处理数据 v2"');
  assert.equal(run('undo'), 'box#n1 label restored: "old"');
  assert.match(run('show n1-label') ?? '', /text="old"/);
  assert.equal(run('undo'), 'box#n1 fill restored');
  assert.doesNotMatch(run('show n1-rect') ?? '', /#f5a623/);
  assert.equal(run('redo'), 'box#n1 fill propagated to n1-rect');
  assert.equal(run('redo'), 'box#n1 label updated: "处理数据 v2"');
});

test('derived-id collision rejects creation atomically without partial parts', () => {
  const { application, run } = boxCli();
  run('init');
  run('create box n1-rect 0 0 1 1 "occupied"');
  const before = new SvgWriter().serialize(application.model.document());
  assert.equal(run('create box n1 0 0 1 1 "conflict"'), 'error: id already exists: n1-rect');
  assert.equal(application.model.document().find('n1'), undefined);
  assert.equal(new SvgWriter().serialize(application.model.document()), before);
});

test('ordinary commands cannot delete, group or move away required box parts', () => {
  const { application, run } = boxCli();
  run('init');
  run('create box n1 0 0 100 50 "safe"');
  run('create box target 200 0 100 50 "target"');
  const before = new SvgWriter().serialize(application.model.document());
  for (const command of ['delete n1-rect', 'addto target n1-label', 'group broken n1-rect']) {
    assert.equal(run(command), `error: cannot modify plugin-owned shape part: ${command.includes('label') ? 'n1-label' : 'n1-rect'}`);
  }
  assert.equal(new SvgWriter().serialize(application.model.document()), before);
});

test('invalid box reads reject the entire input and preserve the current document', () => {
  const { application, run } = boxCli();
  run('init');
  run('create box original 0 0 10 10 "keep"');
  const before = new SvgWriter().serialize(application.model.document());
  const missing = fixture('missing-box.svg', '<svg><g id="bad" data-kind="box"><rect id="bad-rect" x="0" y="0" width="1" height="1"/></g></svg>');
  assert.equal(run(`read ${missing}`), 'error: invalid box: missing label part: bad');
  assert.equal(new SvgWriter().serialize(application.model.document()), before);

  const wrongType = fixture('wrong-type-box.svg', '<svg><g id="bad" data-kind="box"><text id="bad-rect" x="0" y="0">wrong</text><text id="bad-label" x="0" y="0">label</text></g></svg>');
  assert.equal(run(`read ${wrongType}`), 'error: invalid box: missing rect part: bad');
  assert.equal(new SvgWriter().serialize(application.model.document()), before);
});

test('duplicate ids in a box read are rejected rather than hidden by degradation', () => {
  const { application, run } = boxCli();
  run('init');
  run('create box original 0 0 10 10 "keep"');
  const before = new SvgWriter().serialize(application.model.document());
  const duplicate = fixture('duplicate-box.svg', '<svg><g id="bad" data-kind="box"><rect id="same" x="0" y="0" width="1" height="1"/><text id="same" x="0" y="0">duplicate</text></g></svg>');
  assert.equal(run(`read ${duplicate}`), 'error: id already exists: same');
  assert.equal(new SvgWriter().serialize(application.model.document()), before);
});

test('box reader accepts valid nested composites and validates after children load', () => {
  const { application, run } = boxCli();
  const file = fixture('valid-box.svg', '<svg><g id="outer" data-kind="box"><rect id="outer-rect" x="0" y="0" width="100" height="100"/><text id="outer-label" x="20" y="35">outer</text><g id="inner" data-kind="box"><rect id="inner-rect" x="1" y="2" width="3" height="4"/><text id="inner-label" x="21" y="37">inner</text></g></g></svg>');
  assert.equal(run(`read ${file}`), `read ${file} (6 elements)`);
  assert.equal(application.model.document().find('outer')?.type, 'box');
  assert.equal(application.model.document().find('inner')?.type, 'box');
});
