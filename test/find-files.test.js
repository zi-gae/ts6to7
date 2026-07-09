import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { findFiles } from '../src/find-files.js';

function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'ts6to7-'));
  for (const file of files) {
    const full = join(root, ...file.split('/'));
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '{}');
  }
  return root;
}

test('finds tsconfig variants and package.json across a monorepo', (t) => {
  const root = makeTree([
    'tsconfig.json',
    'tsconfig.build.json',
    'package.json',
    'packages/app/tsconfig.json',
    'packages/app/package.json',
  ]);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const { tsconfigs, packageJsons } = findFiles(root);
  const rel = (list) => list.map((f) => f.slice(root.length + 1).split(sep).join('/')).sort();
  assert.deepEqual(rel(tsconfigs), ['packages/app/tsconfig.json', 'tsconfig.build.json', 'tsconfig.json']);
  assert.deepEqual(rel(packageJsons), ['package.json', 'packages/app/package.json']);
});

test('skips node_modules, build output, and hidden directories', (t) => {
  const root = makeTree([
    'tsconfig.json',
    'node_modules/dep/tsconfig.json',
    'node_modules/dep/package.json',
    'dist/tsconfig.json',
    '.cache/tsconfig.json',
  ]);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const { tsconfigs, packageJsons } = findFiles(root);
  assert.equal(tsconfigs.length, 1);
  assert.equal(packageJsons.length, 0);
});

test('does not match files that merely contain "tsconfig"', (t) => {
  const root = makeTree(['tsconfig.json.bak', 'not-tsconfig.json', 'tsconfig5.json']);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const { tsconfigs } = findFiles(root);
  assert.equal(tsconfigs.length, 0);
});

test('nonexistent root returns empty results', () => {
  const { tsconfigs, packageJsons } = findFiles('/nonexistent/path/for/ts6to7');
  assert.deepEqual(tsconfigs, []);
  assert.deepEqual(packageJsons, []);
});
