import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'jsonc-parser';
import { transformPackageJson } from '../src/transform-package-json.js';

test('typescript devDependency is bumped to ^7.0.0', () => {
  const { text, changes } = transformPackageJson(`{
  "devDependencies": { "typescript": "^6.2.0" }
}`);
  assert.equal(parse(text).devDependencies.typescript, '^7.0.0');
  assert.equal(changes.length, 1);
});

test('typescript ^7 is left alone', () => {
  const input = `{
  "devDependencies": { "typescript": "^7.1.0" }
}`;
  const { text, changes } = transformPackageJson(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
});

test('compiler-API tools trigger warnings', () => {
  const { warnings } = transformPackageJson(`{
  "devDependencies": { "typescript": "~6.0.4", "ts-node": "^10.9.0", "ts-jest": "^29.0.0" }
}`);
  assert.ok(warnings.some((w) => w.includes('ts-node')));
  assert.ok(warnings.some((w) => w.includes('ts-jest')));
});

test('package.json without typescript is untouched', () => {
  const input = `{ "name": "x", "dependencies": { "react": "^19.0.0" } }`;
  const { text, changes, warnings } = transformPackageJson(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
  assert.equal(warnings.length, 0);
});

test('bare-major ranges like ">=6" and "6" are bumped', () => {
  for (const range of ['>=6', '6']) {
    const { text, changes } = transformPackageJson(`{
  "devDependencies": { "typescript": "${range}" }
}`);
    assert.equal(parse(text).devDependencies.typescript, '^7.0.0', range);
    assert.equal(changes.length, 1, range);
  }
});

test('unparseable range ("latest") is left alone', () => {
  const input = `{ "devDependencies": { "typescript": "latest" } }`;
  const { text, changes } = transformPackageJson(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
});

test('typescript peerDependency below 7 gets a warning, not a bump', () => {
  const input = `{ "peerDependencies": { "typescript": "^6.0.0" } }`;
  const { text, changes, warnings } = transformPackageJson(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
  assert.ok(warnings.some((w) => w.includes('peerDependencies.typescript')));
});

test('typescript peerDependency already allowing 7 gets no warning', () => {
  const { warnings } = transformPackageJson(`{
  "peerDependencies": { "typescript": "^7.0.0" }
}`);
  assert.equal(warnings.length, 0);
});

test('a tool in both dependencies and devDependencies warns once', () => {
  const { warnings } = transformPackageJson(`{
  "dependencies": { "ts-node": "^10.9.0" },
  "devDependencies": { "ts-node": "^10.9.0" }
}`);
  assert.equal(warnings.filter((w) => w.includes('"ts-node"')).length, 1);
});
