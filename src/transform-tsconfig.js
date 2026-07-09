import { parse, modify, applyEdits } from 'jsonc-parser';

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } };

/**
 * Options that were deprecated in TS 5/6 and are removed in TS 7.
 * They are deleted outright; some carry an extra note for the report.
 */
const REMOVED_OPTIONS = {
  charset: null,
  keyofStringsOnly: null,
  noImplicitUseStrict: null,
  noStrictGenericChecks: null,
  suppressExcessPropertyErrors: null,
  suppressImplicitAnyIndexErrors: null,
  out: 'use "outFile" instead if you relied on single-file output',
  ignoreDeprecations: 'the deprecated options it silenced are gone, so the flag has no meaning',
};

function lower(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

/** Join a paths-mapping entry onto the old baseUrl, tsconfig-dir relative. */
function joinBaseUrl(baseUrl, entry) {
  if (entry.startsWith('/')) return entry;
  const base = baseUrl.replace(/\/+$/, '');
  const rest = entry.replace(/^\.\//, '');
  const joined = base === '.' || base === '' ? rest : `${base}/${rest}`;
  return joined.startsWith('.') || joined.startsWith('/') ? joined : `./${joined}`;
}

/**
 * Transform the text of one tsconfig(-like) JSONC file for TypeScript 7.
 * Comment/format preserving. Returns { text, changes, warnings }.
 */
export function transformTsconfig(text) {
  const changes = [];
  const warnings = [];
  let result = text;

  const json = parse(text) ?? {};

  // --- references[].prepend: deprecated in TS 5.5, gone since TS6 ----------
  // Handled before the compilerOptions guard: solution-style tsconfigs have
  // references but no compilerOptions.
  if (Array.isArray(json.references)) {
    let prepends = 0;
    json.references.forEach((ref, i) => {
      if (ref && typeof ref === 'object' && Object.prototype.hasOwnProperty.call(ref, 'prepend')) {
        result = applyEdits(result, modify(result, ['references', i, 'prepend'], undefined, FORMAT));
        prepends += 1;
      }
    });
    if (prepends > 0) {
      changes.push(`removed "prepend" from ${prepends} project reference(s) (option no longer exists in TS7)`);
      warnings.push(
        'Project references no longer prepend referenced output. If you relied on prepend to ' +
          'concatenate outputs, switch to a bundler or explicit outFile ordering.',
      );
    }
  }

  const co = json.compilerOptions;
  if (typeof co !== 'object' || co === null) {
    return { text: result, changes, warnings };
  }

  const edit = (key, value) => {
    result = applyEdits(result, modify(result, ['compilerOptions', key], value, FORMAT));
  };

  // --- target: es3/es5 removed; minimum is ES2015 -------------------------
  const target = lower(co.target);
  if (target === 'es3' || target === 'es5') {
    edit('target', 'ES2015');
    changes.push(`target: "${co.target}" -> "ES2015" (ES5 and below removed in TS7)`);
    warnings.push(
      'target was raised to ES2015: emitted JS now uses classes, let/const, arrow functions etc. ' +
        'If you must ship ES5 (e.g. IE11), transpile the TS7 output with Babel/SWC.',
    );
  }

  // --- module: amd/umd/system/none removed --------------------------------
  const module_ = lower(co.module);
  const removedModules = ['amd', 'umd', 'system', 'none'];
  if (removedModules.includes(module_)) {
    edit('module', 'ESNext');
    changes.push(`module: "${co.module}" -> "ESNext" (removed in TS7)`);
    warnings.push(
      `module "${co.module}" no longer exists: the emitted module format changes to ESM. ` +
        'Your loader/bundler setup needs a manual review.',
    );
  }

  // --- moduleResolution: node10/node/classic removed ----------------------
  const resolution = lower(co.moduleResolution);
  if (resolution === 'node' || resolution === 'node10' || resolution === 'classic') {
    // nodenext requires module nodenext; bundler requires module es2015+/preserve.
    const nodeLike =
      module_ === 'commonjs' || module_ === 'node16' || module_ === 'nodenext' || module_ === undefined;
    if (nodeLike) {
      edit('module', 'NodeNext');
      edit('moduleResolution', 'NodeNext');
      changes.push(
        `moduleResolution: "${co.moduleResolution}" -> "NodeNext"` +
          (lower(co.module) !== 'nodenext' ? ` (module set to "NodeNext" to match)` : ''),
      );
      warnings.push(
        'NodeNext resolution is stricter than the old "node": relative ESM imports need explicit ' +
          'file extensions and package.json "exports" is honored. Run tsc once and fix reported imports.',
      );
    } else {
      edit('moduleResolution', 'Bundler');
      changes.push(`moduleResolution: "${co.moduleResolution}" -> "Bundler"`);
      warnings.push(
        'moduleResolution "Bundler" assumes a bundler (Vite/webpack/esbuild) resolves imports at build time.',
      );
    }
  }

  // --- importsNotUsedAsValues / preserveValueImports -> verbatimModuleSyntax
  const hasINUAV = Object.prototype.hasOwnProperty.call(co, 'importsNotUsedAsValues');
  const hasPVI = Object.prototype.hasOwnProperty.call(co, 'preserveValueImports');
  if (hasINUAV || hasPVI) {
    const wantsVerbatim =
      co.preserveValueImports === true ||
      lower(co.importsNotUsedAsValues) === 'error' ||
      lower(co.importsNotUsedAsValues) === 'preserve';
    if (hasINUAV) edit('importsNotUsedAsValues', undefined);
    if (hasPVI) edit('preserveValueImports', undefined);
    if (wantsVerbatim) {
      edit('verbatimModuleSyntax', true);
      changes.push('importsNotUsedAsValues/preserveValueImports -> verbatimModuleSyntax: true');
      warnings.push(
        'verbatimModuleSyntax requires type-only imports to be written as `import type`. ' +
          'tsc will point at each offending import; most editors can auto-fix them.',
      );
    } else {
      changes.push('removed importsNotUsedAsValues/preserveValueImports (defaults match old behavior)');
    }
  }

  // --- baseUrl removed: fold it into paths ---------------------------------
  if (Object.prototype.hasOwnProperty.call(co, 'baseUrl')) {
    const baseUrl = String(co.baseUrl);
    if (co.paths && typeof co.paths === 'object') {
      const newPaths = {};
      for (const [pattern, targets] of Object.entries(co.paths)) {
        newPaths[pattern] = Array.isArray(targets)
          ? targets.map((t) => joinBaseUrl(baseUrl, String(t)))
          : targets;
      }
      edit('paths', newPaths);
      changes.push(`baseUrl "${baseUrl}" folded into paths (entries now tsconfig-relative)`);
    } else {
      edit('paths', { '*': [joinBaseUrl(baseUrl, '*')] });
      changes.push(`baseUrl "${baseUrl}" -> paths: { "*": ["${joinBaseUrl(baseUrl, '*')}"] }`);
      warnings.push(
        'baseUrl-style bare imports (e.g. `import x from "utils/x"`) now rely on the generated ' +
          '"*" paths mapping. Verify your runtime/bundler resolves them the same way.',
      );
    }
    edit('baseUrl', undefined);
  }

  // --- options removed without replacement ---------------------------------
  for (const [key, note] of Object.entries(REMOVED_OPTIONS)) {
    if (Object.prototype.hasOwnProperty.call(co, key)) {
      edit(key, undefined);
      changes.push(`removed ${key} (option no longer exists in TS7)${note ? ` — ${note}` : ''}`);
    }
  }

  // --- strict becomes the default in TS7 -----------------------------------
  if (!Object.prototype.hasOwnProperty.call(co, 'strict')) {
    // An extending config may inherit strict from its base; pinning false here
    // would override the base and change behavior.
    if (json.extends !== undefined) {
      warnings.push(
        'strict is not set here and this config extends another. TS7 defaults strict to true — ' +
          'make sure the extended chain sets it explicitly, or add strict yourself.',
      );
    } else {
      edit('strict', false);
      changes.push('added explicit strict: false (TS7 flips the default to true)');
      warnings.push(
        'strict: false was added to preserve current behavior. Consider deleting it and fixing ' +
          'strict-mode errors instead — TS7 projects are strict by default.',
      );
    }
  }

  // --- types auto-inclusion behavior change (report only) -------------------
  if (!Object.prototype.hasOwnProperty.call(co, 'types')) {
    warnings.push(
      'No "types" array: TS7 no longer auto-includes every @types/* package. If you rely on ' +
        'ambient types (e.g. @types/node), list them explicitly: "types": ["node"].',
    );
  }

  return { text: result, changes, warnings };
}
