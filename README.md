# ts6to7

[![CI](https://github.com/zi-gae/ts6to7/actions/workflows/ci.yml/badge.svg)](https://github.com/zi-gae/ts6to7/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ts6to7)](https://www.npmjs.com/package/ts6to7)

Codemod that migrates a **TypeScript 5 or 6** project to **TypeScript 7 (tsgo)**.
No install needed — try it in 10 seconds:

```bash
npx ts6to7 --dry
```

![ts6to7 rewriting a legacy tsconfig for TypeScript 7](https://raw.githubusercontent.com/zi-gae/ts6to7/main/docs/demo.gif)

TypeScript 7 is the native (Go) rewrite of the compiler. It removes every option
that TypeScript 5 and 6 marked as deprecated and flips some defaults. Almost all
of the removed options date back to the TS 5.0 deprecation list, so migrating
straight from 5.x works the same as from 6.x — this tool rewrites your config
files to the TS7 equivalents and prints a checklist of the things it cannot
safely change for you.

## Usage

```bash
# preview changes without writing anything
npx ts6to7 --dry

# apply to the current directory (monorepos: scans every package)
npx ts6to7

# apply to a specific directory
npx ts6to7 packages/app
```

Then:

```bash
npm install          # picks up typescript ^7.0.0
npx tsc --noEmit     # fix any remaining errors it reports
```

## What it rewrites

### `tsconfig*.json` (comments and formatting are preserved)

| Before (TS 5/6) | After (TS7) |
| --- | --- |
| `"target": "es3"` / `"es5"` | `"ES2015"` — ES5 output was removed |
| `"module": "amd"` / `"umd"` / `"system"` / `"none"` | `"ESNext"` |
| `"moduleResolution": "node"` / `"node10"` / `"classic"` | `"NodeNext"` (Node-style projects) or `"Bundler"` |
| `"importsNotUsedAsValues"`, `"preserveValueImports"` | `"verbatimModuleSyntax": true` |
| `"baseUrl"` | folded into `"paths"` (mappings become tsconfig-relative) |
| `charset`, `keyofStringsOnly`, `out`, `noImplicitUseStrict`, `noStrictGenericChecks`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors` | removed |
| `"ignoreDeprecations": "5.0"` (the TS5 escape hatch) | removed — the options it silenced no longer exist |
| `"prepend": true` in project `references` | removed — output prepending is gone since TS6 |
| `strict` unset | pinned to `false` to preserve behavior (TS7 defaults to `true`) — delete it when you're ready |

### `package.json`

- Bumps the `typescript` dependency to `^7.0.0`.
- Warns about tools built on the TS compiler API (`ts-node`, `ts-jest`,
  `ts-patch`, `ttypescript`, `ts-loader`, `fork-ts-checker-webpack-plugin`) —
  tsgo 7.0 does not expose the old JS compiler API (a new one ships in 7.1), so
  each of these needs a TS7-compatible version or a replacement.

## What it can't do for you

- **ES5 runtimes**: if you still ship to ES5-only environments, transpile TS7's
  output with Babel/SWC.
- **NodeNext strictness**: relative ESM imports need explicit `.js` extensions;
  `tsc` will list them.
- **`verbatimModuleSyntax` errors**: type-only imports must become
  `import type { ... }`; editors can auto-fix these.
- **Ambient types**: TS7 no longer auto-includes every `@types/*` package —
  add `"types": ["node", ...]` explicitly if you relied on that.

Everything in this list is also printed as a `Needs manual review` item when
the codemod runs, scoped to the file that triggered it.

## Coming from TypeScript 5?

You don't need to stop at 6 first — run the codemod directly on a 5.x project.
The transforms match on option values, not on your current compiler version:
`typescript: "^5.x"` is bumped straight to `^7.0.0`, TS5-era escape hatches
like `"ignoreDeprecations": "5.0"` are cleaned up, and `prepend` in project
references (already gone in TS6) is removed too.

## Development

```bash
npm install
npm test
```

## License

MIT
