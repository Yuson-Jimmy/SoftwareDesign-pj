import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from '../app/Application';
import { Repl } from '../cli/Repl';
import { createPingPlugin, pingManifest } from '../plugins/demo/PingPlugin';

test('ping demo plugin is independently testable and receives code-assembly options', () => {
  const application = createApplication([]);
  const error = application.installPlugin(createPingPlugin({ text: 'configured' }), pingManifest);
  assert.equal(error, null);
  const repl = new Repl(application);
  assert.equal(repl.handleLine('ping'), 'pong configured');
  assert.equal(repl.handleLine('ping extra'), 'error: invalid arguments, usage: ping');
});
