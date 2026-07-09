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
