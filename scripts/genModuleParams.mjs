// Codegen for the instructor Embed Generator param registry.
//
// Parses each module page with the TypeScript compiler API, finds <SliderWithInput>
// usages (direct and via simple local wrapper components), resolves their
// min/max/step/default/key from literals, top-level consts, useState() defaults and
// DEFAULT_* object literals, and emits src/config/moduleParams.generated.ts.
//
// What it intentionally cannot resolve (printed in the report, left to the manual
// override map in moduleParams.ts):
//   - pages that sync via their own useUrlStateSync (sliders use syncToUrl={false})
//   - custom queryKey expressions (e.g. Optics' wrapper)
//   - dynamic per-item keys (`c2d-mass-${i}`) and computed defaults (Math.max(...))
//
// Run: npm run gen:module-params
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = resolve(root, 'src');

// Mirrors toQueryKey() in src/components/SliderWithInput.tsx.
function toQueryKey(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---- route -> page file, parsed from App.tsx ROUTE_CONFIG ----
function readRouteMap() {
  const appText = readFileSync(resolve(srcDir, 'App.tsx'), 'utf8');
  const re = /path:\s*'([^']+)',\s*load:\s*\(\)\s*=>\s*import\('([^']+)'\)/g;
  const map = new Map();
  let m;
  while ((m = re.exec(appText)) !== null) {
    const [, route, importPath] = m;
    if (!importPath.startsWith('./')) continue;
    map.set(route, resolve(srcDir, `${importPath.slice(2)}.tsx`));
  }
  return map;
}

// ---- literal resolution helpers ----
function parseFile(file) {
  const text = readFileSync(file, 'utf8');
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

// Collect const numeric/object/string nodes and useState() defaults across the file.
function collectScope(sourceFile) {
  const numConst = new Map(); // name -> initializer node
  const objConst = new Map(); // name -> ObjectLiteralExpression
  const strConst = new Map(); // name -> string
  const stateInit = new Map(); // varName -> initializer expr node (useState arg)
  const stateObj = new Map(); // varName -> object-const name (useState(DEFAULT))

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = node.initializer;
      // const [v, setV] = useState(arg)
      if (
        ts.isArrayBindingPattern(node.name) &&
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === 'useState' &&
        node.name.elements.length > 0
      ) {
        const first = node.name.elements[0];
        if (ts.isBindingElement(first) && ts.isIdentifier(first.name)) {
          const varName = first.name.text;
          const arg = init.arguments[0];
          if (arg) {
            stateInit.set(varName, arg);
            if (ts.isIdentifier(arg)) stateObj.set(varName, arg.text);
          }
        }
      } else if (ts.isIdentifier(node.name)) {
        const name = node.name.text;
        if (ts.isObjectLiteralExpression(init)) objConst.set(name, init);
        else if (ts.isStringLiteral(init)) strConst.set(name, init.text);
        else numConst.set(name, init); // numeric / unary / binary / identifier
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { numConst, objConst, strConst, stateInit, stateObj };
}

function resolveNum(node, scope, seen = new Set()) {
  if (!node) return undefined;
  if (ts.isParenthesizedExpression(node)) return resolveNum(node.expression, scope, seen);
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const v = resolveNum(node.operand, scope, seen);
    return v === undefined ? undefined : -v;
  }
  if (ts.isBinaryExpression(node)) {
    const l = resolveNum(node.left, scope, seen);
    const r = resolveNum(node.right, scope, seen);
    if (l === undefined || r === undefined) return undefined;
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.SlashToken: return l / r;
      case ts.SyntaxKind.AsteriskToken: return l * r;
      case ts.SyntaxKind.PlusToken: return l + r;
      case ts.SyntaxKind.MinusToken: return l - r;
      default: return undefined;
    }
  }
  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) return undefined;
    seen.add(node.text);
    if (scope.numConst.has(node.text)) return resolveNum(scope.numConst.get(node.text), scope, seen);
  }
  return undefined;
}

function objLookup(objNode, field, scope) {
  for (const prop of objNode.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ((ts.isIdentifier(prop.name) && prop.name.text === field) ||
        (ts.isStringLiteral(prop.name) && prop.name.text === field))
    ) {
      if (ts.isStringLiteral(prop.initializer)) return prop.initializer.text;
      const n = resolveNum(prop.initializer, scope);
      return n;
    }
  }
  return undefined;
}

// Resolve a `value={...}` prop to its default (number or string).
function resolveDefault(node, scope) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node)) return node.text;
  const num = resolveNum(node, scope);
  if (num !== undefined) return num;
  if (ts.isIdentifier(node)) {
    if (scope.stateInit.has(node.text)) return resolveDefault(scope.stateInit.get(node.text), scope);
    return undefined;
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const objName = node.expression.text;
    const field = node.name.text;
    const target = scope.stateObj.get(objName) ?? (scope.objConst.has(objName) ? objName : undefined);
    if (target && scope.objConst.has(target)) return objLookup(scope.objConst.get(target), field, scope);
  }
  return undefined;
}

function resolveStr(node, scope) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node) && scope.strConst.has(node.text)) return scope.strConst.get(node.text);
  return undefined;
}

// Read a JSX attribute's expression (or `true` for shorthand boolean).
function attrExpr(attr) {
  if (!attr.initializer) return { shorthand: true };
  if (ts.isStringLiteral(attr.initializer)) return { node: attr.initializer };
  if (ts.isJsxExpression(attr.initializer)) return { node: attr.initializer.expression };
  return {};
}

function getAttrs(node) {
  const el = ts.isJsxSelfClosingElement(node) ? node : node;
  const props = new Map();
  for (const attr of el.attributes.properties) {
    if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
      props.set(attr.name.text, attrExpr(attr));
    }
  }
  return props;
}

// Is this slider opted out of URL sync? syncToUrl={false}
function isSyncFalse(props) {
  const s = props.get('syncToUrl');
  if (!s || !s.node) return false;
  return s.node.kind === ts.SyntaxKind.FalseKeyword;
}

// Find local wrapper components: a function/arrow whose body renders <SliderWithInput>
// with min/max/value bound to its own parameters. Returns Map<wrapperName, info>.
function findWrappers(sourceFile) {
  const wrappers = new Map();
  const consider = (name, params, body) => {
    if (!name || !params) return;
    const paramNames = new Set();
    for (const p of params) {
      if (ts.isParameter(p) && ts.isObjectBindingPattern(p.name)) {
        for (const e of p.name.elements) if (ts.isIdentifier(e.name)) paramNames.add(e.name.text);
      }
    }
    if (paramNames.size === 0) return;
    let found = null;
    const walk = (n) => {
      if (
        (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) &&
        ts.isIdentifier(n.tagName) &&
        n.tagName.text === 'SliderWithInput'
      ) {
        const props = getAttrs(n);
        const min = props.get('min');
        const isPassthrough =
          min && min.node && ts.isIdentifier(min.node) && paramNames.has(min.node.text);
        if (isPassthrough) found = props;
      }
      ts.forEachChild(n, walk);
    };
    walk(body);
    if (found) {
      const qk = found.get('queryKey');
      let customKey = false;
      if (qk && qk.node) {
        // passthrough identifier (e.g. queryKey={queryKey}) is fine; anything else is custom.
        customKey = !(ts.isIdentifier(qk.node) && paramNames.has(qk.node.text));
      }
      wrappers.set(name, { syncFalse: isSyncFalse(found), customKey });
    }
  };

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      consider(node.name.text, node.parameters, node.body);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = node.initializer;
      if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && init.body) {
        consider(node.name.text, init.parameters, init.body);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return wrappers;
}

// Extract resolved number params + skip reasons from one file.
function extractFile(file) {
  const sourceFile = parseFile(file);
  const scope = collectScope(sourceFile);
  const wrappers = findWrappers(sourceFile);
  const params = [];
  const skips = [];
  const seenKeys = new Set();

  const handleSlider = (props, tagName) => {
    if (isSyncFalse(props)) {
      skips.push(`${tagName}: syncToUrl={false}`);
      return;
    }
    const labelExpr = props.get('label');
    const label = labelExpr ? resolveStr(labelExpr.node, scope) : undefined;
    if (!label) {
      skips.push(`${tagName}: unresolved label`);
      return;
    }
    let key;
    const qk = props.get('queryKey');
    if (qk && qk.node) {
      const qkStr = resolveStr(qk.node, scope);
      if (!qkStr) {
        skips.push(`"${label}": dynamic/custom queryKey`);
        return;
      }
      key = qkStr;
    } else {
      key = toQueryKey(label);
    }
    const min = resolveNum(props.get('min')?.node, scope);
    const max = resolveNum(props.get('max')?.node, scope);
    const step = resolveNum(props.get('step')?.node, scope);
    const def = resolveDefault(props.get('value')?.node, scope);
    const units = props.get('units') ? resolveStr(props.get('units').node, scope) : undefined;
    if (min === undefined || max === undefined || def === undefined) {
      skips.push(`"${label}": unresolved ${min === undefined ? 'min ' : ''}${max === undefined ? 'max ' : ''}${def === undefined ? 'default' : ''}`.trim());
      return;
    }
    if (seenKeys.has(key)) {
      skips.push(`"${label}": duplicate key "${key}" (conditional/tabbed?)`);
      return;
    }
    seenKeys.add(key);
    params.push({
      kind: 'number',
      label,
      key,
      min,
      max,
      step: step ?? 1,
      default: def,
      ...(units ? { units } : {}),
    });
  };

  const visit = (node) => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      ts.isIdentifier(node.tagName)
    ) {
      const tag = node.tagName.text;
      if (tag === 'SliderWithInput') {
        const props = getAttrs(node);
        // Skip the definition site inside a wrapper (min bound to a param identifier).
        const min = props.get('min');
        const insideWrapper = min && min.node && ts.isIdentifier(min.node) && !scope.numConst.has(min.node.text) && resolveNum(min.node, scope) === undefined;
        if (!insideWrapper) handleSlider(props, 'SliderWithInput');
      } else if (wrappers.has(tag)) {
        const info = wrappers.get(tag);
        if (info.syncFalse) {
          skips.push(`<${tag}>: wrapper forces syncToUrl={false}`);
        } else if (info.customKey) {
          skips.push(`<${tag}>: wrapper uses custom queryKey`);
        } else {
          handleSlider(getAttrs(node), tag);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { params, skips };
}

// ---- run ----
const routeMap = readRouteMap();
const registry = {};
const report = [];

for (const [route, file] of routeMap) {
  let result;
  try {
    result = extractFile(file);
  } catch (err) {
    report.push(`${route}: ERROR ${err.message}`);
    continue;
  }
  if (result.params.length > 0) registry[route] = result.params;
  if (result.skips.length > 0) {
    report.push(`${route} (${result.params.length} ok): ${result.skips.join('; ')}`);
  }
}

// Emit generated registry, routes sorted for stable diffs.
const sortedRoutes = Object.keys(registry).sort();
const lines = [];
lines.push('// AUTO-GENERATED by scripts/genModuleParams.mjs — do not edit by hand.');
lines.push('// Re-run: npm run gen:module-params');
lines.push("import type { ModuleParam } from './moduleParams';");
lines.push('');
lines.push('export const GENERATED_MODULE_PARAMS: Record<string, ModuleParam[]> = {');
for (const route of sortedRoutes) {
  lines.push(`  ${JSON.stringify(route)}: [`);
  for (const p of registry[route]) {
    lines.push(`    ${JSON.stringify(p)},`);
  }
  lines.push('  ],');
}
lines.push('};');
lines.push('');

const outFile = resolve(srcDir, 'config/moduleParams.generated.ts');
writeFileSync(outFile, lines.join('\n'), 'utf8');

console.log(`Generated ${sortedRoutes.length} module(s) -> src/config/moduleParams.generated.ts`);
console.log(sortedRoutes.map((r) => `  ${r} (${registry[r].length})`).join('\n'));
console.log('\n--- Unresolved / skipped (handle via overrides if needed) ---');
console.log(report.length ? report.join('\n') : '  none');
