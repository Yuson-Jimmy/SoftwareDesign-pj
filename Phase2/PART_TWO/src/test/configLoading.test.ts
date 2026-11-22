import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { createConfiguredApplication } from '../app/ConfiguredApplication';
import { createDefaultApplication, Application } from '../app/Application';
import { Repl } from '../cli/Repl';

const root = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(root, '.test-output', 'plugin-loading');

function fixture(name: string, main: string, contributes: unknown): string {
  const directory = path.join(fixtureRoot, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.js'), main);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, main: 'index.js', contributes }));
  return directory;
}

function config(name: string, entries: unknown): string {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const file = path.join(fixtureRoot, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify({ plugins: entries }));
  return file;
}

function moduleName(directory: string): string {
  return path.relative(fixtureRoot, directory).replaceAll('\\', '/');
}

function load(file: string): { application: Application; errors: string[] } {
  const errors: string[] = [];
  return { application: createConfiguredApplication(file, (message) => errors.push(message)), errors };
}

function transcript(application: Application, file: string): string {
  const repl = new Repl(application);
  const outputs = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((line) => repl.handleLine(line))
    .filter((output): output is string => output !== null);
  return outputs.length ? `${outputs.join('\n')}\n` : '';
}

test('config loading resolves relative packages, passes options and skips disabled entries', () => {
  const optionPlugin = fixture('option-label', `
    module.exports.default = {
      name: 'option-label',
      activate(ctx, options) {
        ctx.registerDecorator({ name: 'option-label', decorations(shape) {
          return shape.id ? [options.text] : [];
        } });
      }
    };
  `, { decorators: ['option-label'] });
  const file = config('options', [
    { module: '../../src/plugins/builtin' },
    { module: `./${moduleName(optionPlugin)}`, options: { text: '(configured)' } },
    { module: './does-not-exist', enabled: false },
  ]);
  const { application, errors } = load(file);
  assert.deepEqual(errors, []);
  const repl = new Repl(application);
  repl.handleLine('init');
  repl.handleLine('create rect r 0 0 1 1');
  assert.equal(repl.handleLine('tree'), 'svg (800x600)\n└── rect#r  x=0 y=0 w=1 h=1 (configured)');
});

test('loader reports failures, rolls back partial activation and continues in order', () => {
  const noDefault = fixture('no-default', 'module.exports = {};', {});
  const mismatch = fixture('manifest-mismatch', 'module.exports.default = { name: "manifest-mismatch" };', { shapes: ['ghost'] });
  const failing = fixture('failing', `
    module.exports.default = { name: 'failing', activate(ctx) {
      ctx.registerDecorator({ name: 'leaked', decorations() { return ['leaked']; } });
      throw new Error('boom');
    } };
  `, { decorators: ['leaked'] });
  const duplicate = fixture('duplicate', `
    module.exports.default = { name: 'duplicate', activate(ctx) {
      ctx.registerShape({ type: 'rect', create() { throw new Error('unused'); }, load() { return null; } });
    } };
  `, { shapes: ['rect'] });
  const brokenDependency = fixture('broken-dependency', 'require("./missing-dependency");', {});
  const optionPlugin = fixture('later', `
    module.exports.default = { name: 'later', activate(ctx) {
      ctx.registerDecorator({ name: 'later', decorations(shape) { return shape.id ? ['later'] : []; } });
    } };
  `, { decorators: ['later'] });
  const file = config('failures', [
    { module: '../../src/plugins/builtin' },
    { module: './missing-plugin' },
    { module: `./${moduleName(noDefault)}` },
    { module: `./${moduleName(mismatch)}` },
    { module: `./${moduleName(failing)}` },
    { module: `./${moduleName(duplicate)}` },
    { module: `./${moduleName(brokenDependency)}` },
    { module: `./${moduleName(optionPlugin)}` },
  ]);
  const { application, errors } = load(file);
  assert.equal(errors[0], 'error: plugin not found: ./missing-plugin');
  assert.equal(errors[1], `error: plugin has no default export: ./${moduleName(noDefault)}`);
  assert.match(errors[2], /^error: plugin manifest mismatch: manifest-mismatch \(declared: shapes=ghost, registered: \(none\)\)$/);
  assert.equal(errors[3], 'error: plugin failed to activate: failing (boom)');
  assert.equal(errors[4], 'error: duplicate registration: shapes/rect');
  assert.match(errors[5], /^error: plugin failed to activate: .*broken-dependency.*Cannot find module/);
  assert.equal(errors.length, 6);

  const repl = new Repl(application);
  repl.handleLine('init');
  repl.handleLine('create rect r 0 0 1 1');
  assert.equal(repl.handleLine('tree'), 'svg (800x600)\n└── rect#r  x=0 y=0 w=1 h=1 later');
});

test('invalid configuration falls back to default built-in capabilities', () => {
  const file = path.join(fixtureRoot, 'invalid.json');
  fs.mkdirSync(fixtureRoot, { recursive: true });
  fs.writeFileSync(file, '{not-json');
  const { application, errors } = load(file);
  assert.deepEqual(errors, ['error: invalid plugin config']);
  const repl = new Repl(application);
  repl.handleLine('init');
  assert.equal(repl.handleLine('create box b 0 0 1 1 "ok"'), 'box#b created (g#b + rect#b-rect + text#b-label)');
  assert.equal(repl.handleLine('stats'), 'rect: 1  text: 1  (total 2, containers 1)');
});

test('code and config assembly produce byte-identical Phase1, box, stats and dir transcripts', () => {
  const workdir = path.join(fixtureRoot, 'fixed-cwd');
  fs.mkdirSync(path.join(workdir, 'alpha'), { recursive: true });
  fs.mkdirSync(path.join(workdir, 'zeta'), { recursive: true });
  fs.writeFileSync(path.join(workdir, 'a.txt'), 'a');
  const previous = process.cwd();
  try {
    process.chdir(workdir);
    for (const name of ['cli-1', 'box', 'commands']) {
      const input = path.join(root, 'docs', 'transcript', `${name}.txt`);
      const expected = fs.readFileSync(path.join(root, 'docs', 'transcript', `${name}.expected.txt`), 'utf8');
      const byCode = transcript(createDefaultApplication(), input);
      const byConfig = transcript(createConfiguredApplication(path.join(root, 'plugins.config.json')), input);
      assert.equal(byCode, expected, `${name}: code assembly baseline`);
      assert.equal(byConfig, byCode, `${name}: config assembly differs`);
    }
  } finally {
    process.chdir(previous);
  }
});
