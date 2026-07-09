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

test('extending config does not get strict pinned (base may set it)', () => {
  const input = `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" }
}`;
  const { text, changes, warnings } = transformTsconfig(input);
  assert.equal(co(text).strict, undefined);
  assert.ok(!changes.some((c) => c.includes('strict')));
  assert.ok(warnings.some((w) => w.includes('extends')));
});

test('extending config with explicit strict gets no strict warning', () => {
  const { warnings } = transformTsconfig(`{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "strict": true, "types": [] }
}`);
  assert.ok(!warnings.some((w) => w.includes('strict')));
});

test('uppercase "ES5" target is also raised', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "target": "ES5", "strict": true }
}`);
  assert.equal(co(text).target, 'ES2015');
});

test('preserveValueImports: true -> verbatimModuleSyntax', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "preserveValueImports": true, "strict": true }
}`);
  const options = co(text);
  assert.equal(options.preserveValueImports, undefined);
  assert.equal(options.verbatimModuleSyntax, true);
});

test('module umd + moduleResolution node -> ESNext + Bundler', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "module": "umd", "moduleResolution": "node", "strict": true }
}`);
  assert.equal(co(text).module, 'ESNext');
  assert.equal(co(text).moduleResolution, 'Bundler');
});

test('moduleResolution node without module -> NodeNext pair', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "moduleResolution": "node", "strict": true }
}`);
  assert.equal(co(text).module, 'NodeNext');
  assert.equal(co(text).moduleResolution, 'NodeNext');
});

test('CRLF line endings are preserved', () => {
  const input = '{\r\n  "compilerOptions": {\r\n    "target": "es5",\r\n    "strict": true\r\n  }\r\n}';
  const { text } = transformTsconfig(input);
  assert.equal(co(text).target, 'ES2015');
  assert.ok(!/[^\r]\n/.test(text), 'no bare LF was introduced');
});

test('baseUrl "." folds paths entries as ./-relative', () => {
  const { text } = transformTsconfig(`{
  "compilerOptions": { "baseUrl": ".", "paths": { "@app/*": ["app/*"] }, "strict": true }
}`);
  assert.deepEqual(co(text).paths['@app/*'], ['./app/*']);
});

test('ignoreDeprecations is removed (TS5 escape hatch)', () => {
  const { text, changes } = transformTsconfig(`{
  "compilerOptions": { "ignoreDeprecations": "5.0", "strict": true }
}`);
  assert.equal(co(text).ignoreDeprecations, undefined);
  assert.ok(changes.some((c) => c.includes('ignoreDeprecations')));
});

test('prepend is stripped from project references, path is kept', () => {
  const { text, changes, warnings } = transformTsconfig(`{
  "compilerOptions": { "strict": true, "types": [] },
  "references": [
    { "path": "../core", "prepend": true },
    { "path": "../utils" }
  ]
}`);
  const refs = parse(text).references;
  assert.deepEqual(refs, [{ path: '../core' }, { path: '../utils' }]);
  assert.ok(changes.some((c) => c.includes('prepend')));
  assert.ok(warnings.some((w) => w.includes('prepend')));
});

test('solution-style tsconfig (no compilerOptions) still loses prepend', () => {
  const { text, changes } = transformTsconfig(`{
  "files": [],
  "references": [{ "path": "./packages/a", "prepend": true }]
}`);
  assert.deepEqual(parse(text).references, [{ path: './packages/a' }]);
  assert.equal(changes.length, 1);
});

test('references without prepend are untouched', () => {
  const input = `{
  "compilerOptions": { "strict": true, "types": [] },
  "references": [{ "path": "../core" }]
}`;
  const { text, changes } = transformTsconfig(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
});

test('typical TS5-era config migrates in one idempotent pass', () => {
  const once = transformTsconfig(`{
  "compilerOptions": {
    "target": "es5",
    "module": "commonjs",
    "moduleResolution": "node",
    "importsNotUsedAsValues": "error",
    "ignoreDeprecations": "5.0",
    "baseUrl": "."
  },
  "references": [{ "path": "../lib", "prepend": true }]
}`);
  const options = co(once.text);
  assert.equal(options.target, 'ES2015');
  assert.equal(options.moduleResolution, 'NodeNext');
  assert.equal(options.verbatimModuleSyntax, true);
  assert.equal(options.ignoreDeprecations, undefined);
  assert.equal(options.baseUrl, undefined);
  assert.equal(options.strict, false);
  assert.deepEqual(parse(once.text).references, [{ path: '../lib' }]);

  const twice = transformTsconfig(once.text);
  assert.equal(twice.text, once.text);
  assert.equal(twice.changes.length, 0);
});

test('non-JSON input is returned unchanged', () => {
  const input = 'not json at all';
  const { text, changes, warnings } = transformTsconfig(input);
  assert.equal(text, input);
  assert.equal(changes.length, 0);
  assert.equal(warnings.length, 0);
});
