import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../src/cli.js';

const TSCONFIG = `{
  // legacy
  "compilerOptions": { "target": "es5", "strict": true }
}`;

function makeProject(t) {
  const root = mkdtempSync(join(tmpdir(), 'ts6to7-cli-'));
  writeFileSync(join(root, 'tsconfig.json'), TSCONFIG);
  writeFileSync(join(root, 'package.json'), `{ "devDependencies": { "typescript": "^6.0.0" } }`);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function silenced(fn) {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = log;
      console.error = error;
    });
}

test('--help exits 0 without touching files', async (t) => {
  const root = makeProject(t);
  const code = await silenced(() => run([root, '--help']));
  assert.equal(code, 0);
  assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), TSCONFIG);
});

test('unknown flag exits 1 and writes nothing', async (t) => {
  const root = makeProject(t);
  const code = await silenced(() => run([root, '--dr']));
  assert.equal(code, 1);
  assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), TSCONFIG);
});

test('--dry reports changes but writes nothing', async (t) => {
  const root = makeProject(t);
  const code = await silenced(() => run([root, '--dry']));
  assert.equal(code, 0);
  assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), TSCONFIG);
  assert.ok(readFileSync(join(root, 'package.json'), 'utf8').includes('^6.0.0'));
});

test('real run rewrites files and preserves comments', async (t) => {
  const root = makeProject(t);
  const code = await silenced(() => run([root]));
  assert.equal(code, 0);
  const tsconfig = readFileSync(join(root, 'tsconfig.json'), 'utf8');
  assert.ok(tsconfig.includes('"ES2015"'));
  assert.ok(tsconfig.includes('// legacy'));
  assert.ok(readFileSync(join(root, 'package.json'), 'utf8').includes('"^7.0.0"'));
});

test('second run is a no-op (idempotent)', async (t) => {
  const root = makeProject(t);
  await silenced(() => run([root]));
  const after = readFileSync(join(root, 'tsconfig.json'), 'utf8');
  const code = await silenced(() => run([root]));
  assert.equal(code, 0);
  assert.equal(readFileSync(join(root, 'tsconfig.json'), 'utf8'), after);
});

test('directory with no relevant files exits 1', async () => {
  const code = await silenced(() => run(['/nonexistent/path/for/ts6to7']));
  assert.equal(code, 1);
});
