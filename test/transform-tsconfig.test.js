import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'jsonc-parser';
import { transformTsconfig } from '../src/transform-tsconfig.js';

const co = (text) => parse(text).compilerOptions;

test('target es5 is raised to ES2015', () => {
  const { text, changes } = transformTsconfig(`{
  "compilerOptions": { "target": "es5", "strict": true }
}`);
  assert.equal(co(text).target, 'ES2015');
  assert.ok(changes.some((c) => c.includes('target')));
});

test('target es2022 is untouched', () => {
  const input = `{
  "compilerOptions": { "target": "ES2022", "strict": true, "types": [] }
}`;
  const { text, changes, warnings } = transformTsconfig(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
  assert.equal(warnings.length, 0);
});

test('module amd becomes ESNext with a warning', () => {
  const { text, warnings } = transformTsconfig(`{
  "compilerOptions": { "module": "amd", "strict": true }
}`);
  assert.equal(co(text).module, 'ESNext');
  assert.ok(warnings.some((w) => w.includes('amd')));
});

test('moduleResolution node + module commonjs -> NodeNext pair', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "module": "CommonJS", "moduleResolution": "node", "strict": true }
}`);
  assert.equal(co(text).module, 'NodeNext');
  assert.equal(co(text).moduleResolution, 'NodeNext');
});

test('moduleResolution node10 + module esnext -> Bundler', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "module": "ESNext", "moduleResolution": "node10", "strict": true }
}`);
  assert.equal(co(text).module, 'ESNext');
  assert.equal(co(text).moduleResolution, 'Bundler');
});

test('importsNotUsedAsValues: error -> verbatimModuleSyntax', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "importsNotUsedAsValues": "error", "strict": true }
}`);
  const options = co(text);
  assert.equal(options.importsNotUsedAsValues, undefined);
  assert.equal(options.verbatimModuleSyntax, true);
});

test('importsNotUsedAsValues: remove is just deleted', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "importsNotUsedAsValues": "remove", "strict": true }
}`);
  const options = co(text);
  assert.equal(options.importsNotUsedAsValues, undefined);
  assert.equal(options.verbatimModuleSyntax, undefined);
});

test('baseUrl is folded into existing paths', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": { "@app/*": ["app/*"], "abs/*": ["/abs/*"] },
    "strict": true
  }
}`);
  const options = co(text);
  assert.equal(options.baseUrl, undefined);
  assert.deepEqual(options.paths['@app/*'], ['./src/app/*']);
  assert.deepEqual(options.paths['abs/*'], ['/abs/*']);
});

test('baseUrl without paths generates a "*" mapping', () => {
  const { text, warnings } = transformTsconfig(`{
  "compilerOptions": { "baseUrl": "src", "strict": true }
}`);
  const options = co(text);
  assert.equal(options.baseUrl, undefined);
  assert.deepEqual(options.paths['*'], ['./src/*']);
  assert.ok(warnings.some((w) => w.includes('bare imports')));
});

test('removed options are deleted', () => {
  const { text, changes } = transformTsconfig(`{
  "compilerOptions": {
    "charset": "utf8",
    "keyofStringsOnly": true,
    "out": "bundle.js",
    "noStrictGenericChecks": true,
    "strict": true
  }
}`);
  const options = co(text);
  for (const key of ['charset', 'keyofStringsOnly', 'out', 'noStrictGenericChecks']) {
    assert.equal(options[key], undefined, key);
  }
  assert.equal(changes.length, 4);
});

test('missing strict gets pinned to false', () => {
  const { text, warnings } = transformTsconfig(`{
  "compilerOptions": { "target": "ES2020" }
}`);
  assert.equal(co(text).strict, false);
  assert.ok(warnings.some((w) => w.includes('strict')));
});

test('comments are preserved', () => {
  const { text } = transformTsconfig(`{
  // build config
  "compilerOptions": {
    "target": "es5", // legacy
    "strict": true
  }
}`);
  assert.ok(text.includes('// build config'));
  assert.ok(text.includes('// legacy'));
});

test('transform is idempotent', () => {
  const once = transformTsconfig(`{
  "compilerOptions": { "target": "es5", "baseUrl": ".", "moduleResolution": "node" }
}`);
  const twice = transformTsconfig(once.text);
  assert.equal(twice.text, once.text);
  assert.equal(twice.changes.length, 0);
});

test('file without compilerOptions is untouched', () => {
  const input = `{ "extends": "./tsconfig.base.json" }`;
  const { text, changes } = transformTsconfig(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
});
