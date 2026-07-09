import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.turbo']);
const TSCONFIG_RE = /^tsconfig(\..+)?\.json$/;

/**
 * Recursively collect tsconfig*.json and package.json files under root.
 * Returns { tsconfigs: string[], packageJsons: string[] }.
 */
export function findFiles(root) {
  const tsconfigs = [];
  const packageJsons = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full);
      } else if (TSCONFIG_RE.test(entry.name)) {
        tsconfigs.push(full);
      } else if (entry.name === 'package.json') {
        packageJsons.push(full);
      }
    }
  };

  walk(root);
  return { tsconfigs, packageJsons };
}
