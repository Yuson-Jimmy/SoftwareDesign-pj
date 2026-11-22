import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { createApplication } from '../app/Application';
import { Repl } from '../cli/Repl';
import { builtinShapePlugin } from '../plugins/builtin/BuiltinShapePlugin';
import { createModifiedStarPlugin } from '../plugins/builtin/ModifiedStarPlugin';

function labelledCli() {
  const repl = new Repl(createApplication([builtinShapePlugin, createModifiedStarPlugin()]));
  return (line: string) => repl.handleLine(line);
}

function saveTarget(name: string): string {
  const directory = path.resolve('.test-output', 'tree-label');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, name);
}

test('without tree decorators the Phase1 tree baseline is byte-for-byte unchanged', () => {
  const repl = new Repl(createApplication([builtinShapePlugin]));
  repl.handleLine('init');
  repl.handleLine('create g flowchart');
  repl.handleLine('create rect r 0 0 10 20 in flowchart');
  assert.equal(repl.handleLine('tree'), [
    'svg (800x600)',
    '└── g#flowchart',
    '    └── rect#r  x=0 y=0 w=10 h=20',
  ].join('\n'));
});

test('modified-star covers create, save, edit, undo to saved point and redo', () => {
  const run = labelledCli();
  run('init');
  run('create rect r 0 0 1 1');
  assert.equal(run('tree'), 'svg (800x600) *\n└── rect#r  x=0 y=0 w=1 h=1 *');

  const target = saveTarget('state-machine.svg');
  run(`save ${target}`);
  assert.doesNotMatch(run('tree') ?? '', /\*/);

  run('set r fill red');
  assert.match(run('tree') ?? '', /^svg \(800x600\) \*/);
  assert.match(run('tree') ?? '', /rect#r.*fill=red \*$/);
  run('undo');
  assert.doesNotMatch(run('tree') ?? '', /\*/);
  run('redo');
  assert.match(run('tree') ?? '', /rect#r.*fill=red \*$/);

  run(`save ${target}`);
  run('set r fill blue');
  assert.match(run('tree') ?? '', /fill=blue \*$/);
  run('undo');
  assert.doesNotMatch(run('tree') ?? '', /\*/);
});

test('modified-star marks ancestors after a child edit and clears them on undo', () => {
  const run = labelledCli();
  run('init');
  run('create g flowchart');
  run('create rect r 0 0 10 20 in flowchart');
  const target = saveTarget('ancestors.svg');
  run(`save ${target}`);
  assert.doesNotMatch(run('tree') ?? '', /\*/);

  run('move r 5 6');
  assert.equal(run('tree'), [
    'svg (800x600) *',
    '└── g#flowchart *',
    '    └── rect#r  x=5 y=6 w=10 h=20 *',
  ].join('\n'));
  run('undo');
  assert.doesNotMatch(run('tree') ?? '', /\*/);
});

test('modified-star instances do not share saved snapshots between applications', () => {
  const first = labelledCli();
  const second = labelledCli();
  first('init');
  second('init');
  first('create rect shared-id 0 0 1 1');
  second('create rect shared-id 0 0 2 2');
  first(`save ${saveTarget('first.svg')}`);
  assert.doesNotMatch(first('tree') ?? '', /\*/);
  assert.match(second('tree') ?? '', /shared-id.*\*$/);
  assert.match(second('tree') ?? '', /w=2 h=2/);
});
