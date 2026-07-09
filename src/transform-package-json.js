import { parse, modify, applyEdits } from 'jsonc-parser';

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } };

/** Packages built on the TS compiler API, which tsgo (TS7) does not expose (new API lands in 7.1). */
const API_DEPENDENT = ['ts-patch', 'ttypescript', 'ts-node', 'ts-loader', 'ts-jest', 'fork-ts-checker-webpack-plugin'];

const DEP_FIELDS = ['dependencies', 'devDependencies'];

function majorOf(range) {
  const m = String(range).match(/(\d+)\./);
  return m ? Number(m[1]) : null;
}

/**
 * Bump the typescript dependency to ^7 and warn about compiler-API tooling.
 * Returns { text, changes, warnings }.
 */
export function transformPackageJson(text) {
  const changes = [];
  const warnings = [];
  let result = text;

  const json = parse(text) ?? {};

  for (const field of DEP_FIELDS) {
    const deps = json[field];
    if (typeof deps !== 'object' || deps === null) continue;

    if (typeof deps.typescript === 'string') {
      const major = majorOf(deps.typescript);
      if (major !== null && major < 7) {
        result = applyEdits(result, modify(result, [field, 'typescript'], '^7.0.0', FORMAT));
        changes.push(`${field}.typescript: "${deps.typescript}" -> "^7.0.0"`);
      }
    }

    for (const name of API_DEPENDENT) {
      if (deps[name]) {
        warnings.push(
          `"${name}" uses the TypeScript compiler API, which tsgo does not expose in 7.0 ` +
            '(a new API ships with 7.1). Check that your version supports TS7 or find an alternative.',
        );
      }
    }
  }

  return { text: result, changes, warnings };
}
