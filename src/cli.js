import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { findFiles } from './find-files.js';
import { transformTsconfig } from './transform-tsconfig.js';
import { transformPackageJson } from './transform-package-json.js';

const tty = process.stdout.isTTY;
const bold = (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const green = (s) => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const yellow = (s) => (tty ? `\x1b[33m${s}\x1b[0m` : s);
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);

const HELP = `ts6to7 — migrate a TypeScript 6 project to TypeScript 7 (tsgo)

Usage:
  npx ts6to7 [directory] [options]

Options:
  --dry, -d     Show what would change without writing files
  --help, -h    Show this help

What it does:
  tsconfig*.json
    - target es3/es5            -> ES2015 (removed in TS7)
    - module amd/umd/system     -> ESNext (removed in TS7)
    - moduleResolution node10/classic -> NodeNext or Bundler
    - importsNotUsedAsValues / preserveValueImports -> verbatimModuleSyntax
    - baseUrl                   -> folded into "paths" (removed in TS7)
    - removes charset, keyofStringsOnly, out, noImplicitUseStrict, ...
    - pins strict: false if unset (TS7 defaults strict to true)
  package.json
    - typescript dependency     -> ^7.0.0
    - warns about compiler-API tools (ts-node, ts-patch, ts-jest, ...)
`;

export async function run(argv) {
  const args = [...argv];
  const dry = args.includes('--dry') || args.includes('-d');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return 0;
  }
  const dirArg = args.find((a) => !a.startsWith('-'));
  const root = resolve(process.cwd(), dirArg ?? '.');

  const { tsconfigs, packageJsons } = findFiles(root);
  if (tsconfigs.length === 0 && packageJsons.length === 0) {
    console.error(`No tsconfig*.json or package.json found under ${root}`);
    return 1;
  }

  let filesChanged = 0;
  const allWarnings = [];

  const process1 = (file, transform) => {
    const original = readFileSync(file, 'utf8');
    const { text, changes, warnings } = transform(original);
    const rel = relative(root, file) || file;

    if (changes.length > 0) {
      filesChanged++;
      console.log(`\n${bold(rel)}`);
      for (const c of changes) console.log(`  ${green('~')} ${c}`);
      if (!dry && text !== original) writeFileSync(file, text);
    }
    for (const w of warnings) allWarnings.push({ rel, w });
  };

  for (const file of tsconfigs) process1(file, transformTsconfig);
  for (const file of packageJsons) process1(file, transformPackageJson);

  if (allWarnings.length > 0) {
    console.log(`\n${bold('Needs manual review:')}`);
    for (const { rel, w } of allWarnings) {
      console.log(`  ${yellow('!')} ${dim(`[${rel}]`)} ${w}`);
    }
  }

  console.log(
    dry
      ? `\n${filesChanged} file(s) would be updated (dry run — nothing written).`
      : `\n${filesChanged} file(s) updated.`,
  );
  if (!dry && filesChanged > 0) {
    console.log(dim('Next: reinstall dependencies, then run `tsc --noEmit` (or `tsgo`) and fix remaining errors.'));
  }
  return 0;
}
