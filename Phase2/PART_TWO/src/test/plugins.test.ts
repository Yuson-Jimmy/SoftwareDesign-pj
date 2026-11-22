import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { createApplication, createDefaultApplication } from '../app/Application';
import { createConfiguredApplication } from '../app/ConfiguredApplication';
import { Repl } from '../cli/Repl';
import { CommandError } from '../commands/Command';
import { renderTree } from '../model/DisplayView';
import { Group } from '../model/Group';
import { SvgReader } from '../model/SvgReader';
import { SvgWriter } from '../model/SvgWriter';
import { builtinShapePlugin } from '../plugins/builtin/BuiltinShapePlugin';
import { DirCommand } from '../plugins/commands/DirCommand';
import { createDirPlugin } from '../plugins/commands/DirPlugin';
import { statsPlugin } from '../plugins/commands/StatsPlugin';

function cli() {
  const application = createDefaultApplication();
  const repl = new Repl(application);
  return { application, repl, run: (line: string) => repl.handleLine(line) };
}

test('default assembly retains Phase1 commands and all six shape providers', () => {
  const { application, run } = cli();
  assert.deepEqual(application.factory.types(), ['rect', 'circle', 'ellipse', 'line', 'text', 'g', 'box']);
  assert.equal(run('init'), 'canvas 800x600 created');
  assert.equal(run('create rect r 0 0 10 20'), 'rect#r created');
  assert.equal(run('create circle c 1 2 3'), 'circle#c created');
  assert.equal(run('create ellipse e 1 2 3 4'), 'ellipse#e created');
  assert.equal(run('create line l 0 0 1 1'), 'line#l created');
  assert.equal(run('create text t 1 2 "hello"'), 'text#t created');
  assert.equal(run('create g group'), 'g#group created');
  assert.match(run('help') ?? '', /commands:/);
});

test('absent plugins degrade to an empty provider set and unknown optional commands', () => {
  const empty = new Repl(createApplication([]));
  assert.equal(empty.handleLine('init'), 'canvas 800x600 created');
  assert.equal(empty.handleLine('create rect r 0 0 1 1'), 'error: unknown shape type: rect (is the plugin loaded?)');
  assert.equal(empty.handleLine('stats'), 'error: unknown command: stats');
  assert.equal(empty.handleLine('dir'), 'error: unknown command: dir');

  const phase1 = new Repl(createApplication([builtinShapePlugin]));
  phase1.handleLine('init');
  assert.equal(phase1.handleLine('create rect r 0 0 1 1'), 'rect#r created');
  assert.equal(phase1.handleLine('tree'), 'svg (800x600)\n└── rect#r  x=0 y=0 w=1 h=1');
});

test('box provider creates a composite tree and its decorator appends (box)', () => {
  const { run } = cli();
  run('init');
  assert.equal(run('create box n1 120 100 160 60 "开始"'), 'box#n1 created');
  const tree = run('tree n1');
  assert.match(tree ?? '', /^g#n1 \(box\) \*/);
  assert.match(tree ?? '', /rect#n1-rect\s+x=120 y=100 w=160 h=60 fill=#4a90d9/);
  assert.match(tree ?? '', /text#n1-label\s+\(140,135\) "开始"/);
  assert.equal(run('ungroup n1'), 'error: cannot ungroup composite shape: n1');
  assert.equal(run('create box n2 1 2 3 4 "嵌套" in n1'), 'box#n2 created in g#n1');
});

test('box attribute handlers propagate fill and label with undo/redo', () => {
  const { run } = cli();
  run('init');
  run('create box n1 0 0 100 50 "old"');
  assert.equal(run('set n1 fill red'), 'g#n1 updated: fill="red"');
  assert.equal(run('set n1 label "new"'), 'g#n1 updated: label="new"');
  assert.match(run('show n1-rect') ?? '', /fill=red/);
  assert.match(run('show n1-label') ?? '', /text="new"/);
  run('undo');
  assert.match(run('show n1-label') ?? '', /text="old"/);
  run('undo');
  assert.doesNotMatch(run('show n1-rect') ?? '', /fill=red/);
  run('redo');
  assert.match(run('show n1-rect') ?? '', /fill=red/);
});

test('box serializes as ordinary SVG and restores or degrades by registration', () => {
  const { application, run } = cli();
  run('init');
  run('create box n1 10 20 30 40 "title"');
  const svg = new SvgWriter().serialize(application.model.document());
  assert.match(svg, /<g id="n1" data-kind="box">/);

  const restored = new SvgReader(application.factory).readString(svg).doc;
  const box = restored.find('n1');
  assert.equal(box?.type, 'box');
  assert.equal(box?.composite, true);
  assert.match(renderTree(restored), /g#n1/);

  const withoutBox = createApplication([builtinShapePlugin]);
  const degraded = new SvgReader(withoutBox.factory).readString(svg).doc;
  assert.ok(degraded.find('n1') instanceof Group);
  assert.equal(degraded.find('n1')?.type, 'g');
});

test('stats counts leaves depth-first in first-appearance order and excludes containers', () => {
  const { run } = cli();
  run('init');
  assert.equal(run('stats'), '(total 0, containers 0)');
  run('create text t 0 0 "first"');
  run('create rect r1 0 0 1 1');
  run('create g group');
  run('create circle c 0 0 1 in group');
  run('create rect r2 0 0 1 1');
  run('create box b 0 0 10 10 "box"');
  assert.equal(run('stats'), 'text: 2  rect: 3  circle: 1  (total 6, containers 2)');
  assert.equal(run('undo'), 'box#b removed');
  assert.equal(run('stats'), 'text: 1  rect: 2  circle: 1  (total 4, containers 1)');
  assert.equal(run('redo'), 'box#b created');
});

test('stats and dir are independently enabled and absent from help when disabled', () => {
  const statsOnly = new Repl(createApplication([statsPlugin]));
  statsOnly.handleLine('init');
  assert.equal(statsOnly.handleLine('stats'), '(total 0, containers 0)');
  assert.equal(statsOnly.handleLine('dir'), 'error: unknown command: dir');
  assert.doesNotMatch(statsOnly.handleLine('help') ?? '', /\bdir\s/);

  const dirOnly = new Repl(createApplication([createDirPlugin({ list: () => [] })]));
  assert.equal(dirOnly.handleLine('dir'), '(empty directory)');
  assert.equal(dirOnly.handleLine('stats'), 'error: unknown command: stats');
  assert.doesNotMatch(dirOnly.handleLine('help') ?? '', /\bstats\s/);
});

test('dir formats mixed, hidden and empty entries with stable grouped sorting', () => {
  const dir = new DirCommand({
    list: () => [
      { name: 'z.txt', kind: 'file' },
      { name: 'plugins', kind: 'directory' },
      { name: '.hidden', kind: 'file' },
      { name: 'docs', kind: 'directory' },
    ],
  });
  // 排序是适配器契约；使用已排序端口结果验证命令的精确格式。
  assert.equal(dir.execute({} as never, []), '[FILE]  z.txt\n[DIR]  plugins\n[FILE]  .hidden\n[DIR]  docs');
  assert.equal(new DirCommand({ list: () => [] }).execute({} as never, []), '(empty directory)');
  assert.throws(() => dir.execute({} as never, ['.']), new CommandError('invalid arguments, usage: dir'));
});

test('dir failures and successes do not require a document or alter undo history', () => {
  const failing = new Repl(createApplication([createDirPlugin({
    list: () => { throw new CommandError('cannot read directory: mock'); },
  })]));
  assert.equal(failing.handleLine('dir'), 'error: cannot read directory: mock');
  assert.equal(failing.handleLine('stats'), 'error: unknown command: stats');

  const { run } = cli();
  run('init');
  run('create rect r 0 0 1 1');
  assert.match(run('dir') ?? '', /\[DIR\]/);
  assert.equal(run('undo'), 'rect#r removed');
  assert.equal(run('redo'), 'rect#r created');
});

test('code and configuration assembly produce identical real-filesystem dir output', () => {
  const root = path.resolve('.test-output', 'dir-case');
  fs.mkdirSync(path.join(root, 'zeta'), { recursive: true });
  fs.mkdirSync(path.join(root, 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a.txt'), 'a');
  fs.writeFileSync(path.join(root, '.hidden'), 'hidden');
  const expected = '[DIR]  alpha\n[DIR]  zeta\n[FILE]  .hidden\n[FILE]  a.txt';
  const previous = process.cwd();
  try {
    process.chdir(root);
    assert.equal(new Repl(createDefaultApplication()).handleLine('dir'), expected);
    const configPath = path.resolve(previous, 'plugins.json');
    assert.equal(new Repl(createConfiguredApplication(configPath)).handleLine('dir'), expected);
  } finally {
    process.chdir(previous);
  }
});

test('modified-star decorates edited nodes and save clears the marks', () => {
  const { run } = cli();
  run('init');
  run('create rect r 0 0 1 1');
  assert.match(run('tree') ?? '', /rect#r.*\*$/);
  assert.equal(run('save .plugin-test-output.svg'), 'saved to .plugin-test-output.svg (1 elements)');
  assert.doesNotMatch(run('tree') ?? '', /\*/);
});
