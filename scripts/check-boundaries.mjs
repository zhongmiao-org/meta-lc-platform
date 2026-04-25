import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_DRIVER_PACKAGES = new Set(['audit', 'datasource', 'kernel']);
const DB_DRIVER_DEPENDENCIES = new Set(['pg', '@types/pg']);
const ALLOWED_PG_IMPORT_FILES = new Set([
  'packages/datasource/src/infra/postgres/postgres.adapter.ts',
  'packages/datasource/src/infra/postgres/postgres-demo-orders-mutation.adapter.ts',
  'packages/datasource/src/infra/postgres/postgres-org-scope.adapter.ts',
  'packages/kernel/src/infra/persistence/postgres-meta-kernel-repository.ts',
  'packages/audit/src/infra/postgres-runtime-audit.sink.ts'
]);
const FORBIDDEN_PACKAGE_DIRS = [
  'packages/contracts',
  'packages/shared',
  'packages/platform',
  'packages/migration'
];
const FORBIDDEN_PACKAGE_REFS = [
  '@zhongmiao/meta-lc-contracts',
  '@zhongmiao/meta-lc-shared',
  '@zhongmiao/meta-lc-platform',
  '@zhongmiao/meta-lc-migration'
];
const FORBIDDEN_KERNEL_DEPS = [
  '@zhongmiao/meta-lc-runtime',
  '@zhongmiao/meta-lc-bff',
  '@zhongmiao/meta-lc-query',
  '@zhongmiao/meta-lc-permission',
  '@zhongmiao/meta-lc-datasource',
  '@zhongmiao/meta-lc-audit'
];
const FORBIDDEN_QUERY_DEPS = [
  '@zhongmiao/meta-lc-runtime',
  '@zhongmiao/meta-lc-datasource',
  '@zhongmiao/meta-lc-permission',
  '@zhongmiao/meta-lc-bff',
  '@zhongmiao/meta-lc-audit'
];
const FORBIDDEN_PERMISSION_DEPS = [
  '@zhongmiao/meta-lc-runtime',
  '@zhongmiao/meta-lc-datasource',
  '@zhongmiao/meta-lc-bff',
  '@zhongmiao/meta-lc-audit'
];
const FORBIDDEN_DATASOURCE_DEPS = [
  '@zhongmiao/meta-lc-runtime',
  '@zhongmiao/meta-lc-query',
  '@zhongmiao/meta-lc-permission',
  '@zhongmiao/meta-lc-bff',
  '@zhongmiao/meta-lc-audit'
];
const FORBIDDEN_AUDIT_DEPS = [
  '@zhongmiao/meta-lc-runtime',
  '@zhongmiao/meta-lc-bff',
  '@zhongmiao/meta-lc-query',
  '@zhongmiao/meta-lc-permission',
  '@zhongmiao/meta-lc-datasource'
];
const FORBIDDEN_BFF_DEPS = [
  '@zhongmiao/meta-lc-datasource',
  '@zhongmiao/meta-lc-permission',
  '@zhongmiao/meta-lc-query',
  '@zhongmiao/meta-lc-audit',
  'pg',
  '@types/pg'
];
const ALLOWED_APP_DEPS = {
  'bff-server': new Set(['@zhongmiao/meta-lc-bff'])
};
const BFF_TOP_LEVEL_DIRS = new Set([
  'bootstrap',
  'common',
  'config',
  'controller',
  'infra'
]);
const BFF_FORBIDDEN_SOURCE_DIRS = [
  'packages/bff/src/application',
  'packages/bff/src/application/orchestrator',
  'packages/bff/src/contracts',
  'packages/bff/src/domain',
  'packages/bff/src/mapper',
  'packages/bff/src/infra/interfaces',
  'packages/bff/src/infra/repository',
  'packages/bff/src/interface',
  'packages/bff/src/types'
];
const BFF_INFRA_ALLOWED_DIRS = new Set(['cache', 'integration']);
const BFF_GATEWAY_CONFIG_FORBIDDEN_PATTERNS = [
  /\bLC_DB_/,
  /\bPOSTGRES\b/i,
  /\bBUSINESS_DB\b/i,
  /\bMETA_DB\b/i,
  /\bAUDIT_DB\b/i,
  /\bDATASOURCE\b/i,
  /\bQUERY_COMPILER\b/i,
  /\bPERMISSION_POLICY\b/i,
  /\bNODE_EXECUTION\b/i,
  /\bDATABASE_URL\b/i
];
const FORBIDDEN_BFF_SYMBOLS = [
  'QueryOrchestrator',
  'MutationOrchestrator',
  'QueryOrchestratorService',
  'MutationOrchestratorService',
  'TemporaryViewAdapter',
  'AggregationService',
  'MetaQueryService',
  'RuntimeViewDependenciesService',
  'PostgresQueryExecutorService',
  'RuntimeManagerAdapter'
];
const FORBIDDEN_BFF_RUNTIME_IMPORTS = [
  'compileViewDefinition',
  'executeSubmitPlan',
  'executeQueryNode',
  'executeMutationNode'
];
const RUNTIME_FORBIDDEN_SOURCE_DIRS = [
  'packages/runtime/src/application/orchestrator'
];
const KERNEL_STRUCTURE_CONTRACT_DECLARATIONS = [
  'ViewDefinition',
  'NodeDefinition',
  'QueryNodeDefinition',
  'MutationNodeDefinition',
  'TransformNodeDefinition',
  'MergeNodeDefinition',
  'OutputDefinition',
  'SubmitDefinition'
];
const RUNTIME_EXECUTION_CONTRACT_DECLARATIONS = [
  'ExecutionNode',
  'ExecutionPlan',
  'Expression',
  'RuntimeContext'
];

export function checkWorkspace(root = process.cwd()) {
  const packagesDir = path.join(root, 'packages');
  const appsDir = path.join(root, 'apps');
  const violations = [];
  checkForbiddenPackageDirs(root, violations);
  checkBffLayout(root, violations);
  checkRuntimeLayout(root, violations);
  walk(packagesDir, root, violations);
  walk(appsDir, root, violations);
  return violations;
}

function checkForbiddenPackageDirs(root, violations) {
  for (const forbidden of FORBIDDEN_PACKAGE_DIRS) {
    if (fs.existsSync(path.join(root, forbidden))) {
      violations.push(`${forbidden}: forbidden transitional package directory.`);
    }
  }
}

function checkBffLayout(root, violations) {
  const bffSrc = path.join(root, 'packages', 'bff', 'src');
  if (!fs.existsSync(bffSrc)) return;

  for (const forbidden of BFF_FORBIDDEN_SOURCE_DIRS) {
    if (fs.existsSync(path.join(root, forbidden))) {
      violations.push(`${forbidden}: forbidden BFF source directory.`);
    }
  }

  for (const entry of sortedDirents(bffSrc)) {
    if (entry.name.startsWith('.')) continue;
    const rel = normalizePath(path.relative(root, path.join(bffSrc, entry.name)));
    if (BFF_FORBIDDEN_SOURCE_DIRS.includes(rel)) continue;
    if (entry.isDirectory() && !BFF_TOP_LEVEL_DIRS.has(entry.name)) {
      violations.push(`${rel}: unsupported BFF top-level source directory.`);
    }
    if (entry.isFile() && entry.name !== 'index.ts') {
      violations.push(`${rel}: unsupported BFF top-level source file.`);
    }
  }

  const bffInfra = path.join(bffSrc, 'infra');
  if (!fs.existsSync(bffInfra)) return;
  for (const entry of sortedDirents(bffInfra)) {
    if (entry.name.startsWith('.')) continue;
    const rel = normalizePath(path.relative(root, path.join(bffInfra, entry.name)));
    if (entry.isDirectory() && !BFF_INFRA_ALLOWED_DIRS.has(entry.name)) {
      violations.push(`${rel}: unsupported BFF infra directory.`);
    }
    if (entry.isFile()) {
      violations.push(`${rel}: unsupported BFF infra top-level file.`);
    }
  }
}

function checkRuntimeLayout(root, violations) {
  for (const forbidden of RUNTIME_FORBIDDEN_SOURCE_DIRS) {
    if (fs.existsSync(path.join(root, forbidden))) {
      violations.push(`${forbidden}: forbidden runtime source directory.`);
    }
  }
}

function walk(dir, root, violations) {
  if (!fs.existsSync(dir)) return;
  for (const entry of sortedDirents(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') continue;
      walk(full, root, violations);
      continue;
    }
    if (entry.isFile() && entry.name === 'package.json') checkPackageManifest(full, root, violations);
    if (entry.isFile() && full.endsWith('.ts')) checkSourceFile(full, root, violations);
  }
}

function sortedDirents(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
}

function checkSourceFile(file, root, violations) {
  const rel = normalizePath(path.relative(root, file));
  const content = fs.readFileSync(file, 'utf8');
  checkForbiddenPackageRefs(rel, content, violations);
  checkBffSourceFile(rel, content, file, root, violations);
  checkContractDefinitions(rel, content, violations);

  // No deep cross-package imports.
  const deepImport = content.match(/from\s+["'](?:@meta-lc\/[a-z-]+|@zhongmiao\/meta-lc-[a-z-]+)\//g);
  if (deepImport) {
    violations.push(`${rel}: deep import from package internals is forbidden.`);
  }

  // DB driver access is a hard boundary: only explicit DB edge files may import pg.
  if (importsPg(content)) {
    const packageName = getPackageName(rel);
    if (!DB_DRIVER_PACKAGES.has(packageName)) {
        violations.push(`${rel}: direct pg import is forbidden outside audit/datasource/kernel packages.`);
    } else if (!ALLOWED_PG_IMPORT_FILES.has(rel)) {
      violations.push(`${rel}: direct pg import is not allowed here.`);
    }
  }

  // Kernel must not depend on bff/query/datasource implementation.
  if (rel.startsWith('packages/kernel/')) {
    for (const dep of FORBIDDEN_KERNEL_DEPS) {
      if (content.includes(dep)) {
        violations.push(`${rel}: kernel cannot depend on ${dep}.`);
      }
    }
  }
  if (rel.startsWith('packages/query/')) {
    for (const dep of FORBIDDEN_QUERY_DEPS) {
      if (content.includes(dep)) {
        violations.push(`${rel}: query cannot depend on ${dep}.`);
      }
    }
  }
  if (rel.startsWith('packages/permission/')) {
    for (const dep of FORBIDDEN_PERMISSION_DEPS) {
      if (content.includes(dep)) {
        violations.push(`${rel}: permission cannot depend on ${dep}.`);
      }
    }
  }
  if (rel.startsWith('packages/datasource/')) {
    for (const dep of FORBIDDEN_DATASOURCE_DEPS) {
      if (content.includes(dep)) {
        violations.push(`${rel}: datasource cannot depend on ${dep}.`);
      }
    }
  }
  if (rel.startsWith('packages/audit/')) {
    for (const dep of FORBIDDEN_AUDIT_DEPS) {
      if (content.includes(dep)) {
        violations.push(`${rel}: audit cannot depend on ${dep}.`);
      }
    }
  }
  if (rel.startsWith('packages/bff/')) {
    for (const dep of FORBIDDEN_BFF_DEPS) {
      if (content.includes(dep)) {
        violations.push(`${rel}: BFF cannot depend on ${dep}.`);
      }
    }
    if (rel.includes('manager-adapter')) {
      violations.push(`${rel}: runtime manager-adapter references are forbidden.`);
    }
  }
  if (rel.startsWith('packages/runtime/') && rel.includes('manager-adapter')) {
    violations.push(`${rel}: runtime manager-adapter references are forbidden.`);
  }
  if (rel === 'packages/runtime/test/runtime-manager-event.test.ts') {
    violations.push(`${rel}: runtime manager event test naming is forbidden; use runtime-interaction-event.test.ts.`);
  }
  if (rel.startsWith('apps/bff-server/')) {
    for (const dep of [
      '@zhongmiao/meta-lc-runtime',
      '@zhongmiao/meta-lc-kernel',
      '@zhongmiao/meta-lc-query',
      '@zhongmiao/meta-lc-permission',
      '@zhongmiao/meta-lc-datasource',
      '@zhongmiao/meta-lc-audit'
    ]) {
      if (content.includes(dep)) {
        violations.push(`${rel}: bff-server app can only depend on @zhongmiao/meta-lc-bff.`);
      }
    }
  }
}

function checkBffSourceFile(rel, content, file, root, violations) {
  if (!rel.startsWith('packages/bff/src/')) return;

  for (const symbol of FORBIDDEN_BFF_SYMBOLS) {
    if (content.includes(symbol)) {
      violations.push(`${rel}: legacy BFF orchestrator symbol "${symbol}" is forbidden.`);
    }
  }

  if (rel.startsWith('packages/bff/src/controller/') && /@Post\(\s*["'](?:query|mutation)["']\s*\)/.test(content)) {
    violations.push(`${rel}: legacy /query and /mutation endpoints are forbidden.`);
  }

  checkBffRuntimeImports(rel, content, violations);
  checkBffGatewayConfig(rel, content, violations);
  checkBffMetaRegistryGateway(rel, content, violations);

  if (/\/(?:types|interfaces)\/index\.ts$/.test(rel)) {
    violations.push(`${rel}: type/interface index aggregators are forbidden in BFF.`);
  }

  if (rel.endsWith('.interface.ts')) {
    if (/^\s*(?:export\s+)?type\s+\w+\s*=/m.test(content) || /^\s*export\s+type\s+\{/m.test(content)) {
      violations.push(`${rel}: *.interface.ts files may not export type declarations.`);
    }
    if (/^\s*export\s+(?:class|const|let|var|function|enum)\b/m.test(content)) {
      violations.push(`${rel}: *.interface.ts files may only export interface declarations.`);
    }
  } else if (rel.endsWith('.type.ts')) {
    if (/^\s*(?:export\s+)?interface\s+\w+/m.test(content)) {
      violations.push(`${rel}: *.type.ts files may not export interface declarations.`);
    }
    if (/^\s*export\s+(?:class|const|let|var|function|enum)\b/m.test(content)) {
      violations.push(`${rel}: *.type.ts files may only export type declarations.`);
    }
  } else if (hasTypeOrInterfaceDeclaration(content)) {
    violations.push(`${rel}: TypeScript type/interface declarations must live in a *.type.ts or *.interface.ts file.`);
  }

  if (rel.startsWith('packages/bff/src/dto/') && hasTypeOrInterfaceDeclaration(content)) {
    violations.push(`${rel}: BFF dto files must be class-only.`);
  }

  checkBffDependencyDirection(rel, content, file, root, violations);
}

function checkBffGatewayConfig(rel, content, violations) {
  if (!rel.startsWith('packages/bff/src/config/')) return;

  for (const pattern of BFF_GATEWAY_CONFIG_FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`${rel}: BFF gateway config may not read DB/data/runtime execution settings.`);
      return;
    }
  }
}

function checkBffMetaRegistryGateway(rel, content, violations) {
  if (rel !== 'packages/bff/src/infra/integration/meta-registry.service.ts') return;

  for (const dep of ['@zhongmiao/meta-lc-runtime', '@zhongmiao/meta-lc-query', '@zhongmiao/meta-lc-datasource', '@zhongmiao/meta-lc-permission', '@zhongmiao/meta-lc-audit', 'pg']) {
    if (content.includes(dep)) {
      violations.push(`${rel}: BFF meta registry gateway may only depend on kernel.`);
    }
  }
}

function checkBffRuntimeImports(rel, content, violations) {
  const runtimeImports = findNamedImportsFrom(content, '@zhongmiao/meta-lc-runtime');
  for (const importedName of runtimeImports) {
    if (FORBIDDEN_BFF_RUNTIME_IMPORTS.includes(importedName)) {
      violations.push(`${rel}: BFF must call runtime facade instead of importing ${importedName}.`);
    }
  }
}

function checkContractDefinitions(rel, content, violations) {
  if (!rel.endsWith('.ts')) return;

  if (!rel.startsWith('packages/kernel/src/')) {
    checkContractDeclarations(
      rel,
      content,
      violations,
      KERNEL_STRUCTURE_CONTRACT_DECLARATIONS,
      'structure',
      'packages/kernel'
    );
  }
  if (!rel.startsWith('packages/runtime/src/')) {
    checkContractDeclarations(
      rel,
      content,
      violations,
      RUNTIME_EXECUTION_CONTRACT_DECLARATIONS,
      'execution',
      'packages/runtime'
    );
  }
}

function checkContractDeclarations(rel, content, violations, names, label, owner) {
  for (const name of names) {
    const declaration = new RegExp(`^\\s*export\\s+(?:interface|type)\\s+${name}\\b`, 'm');
    if (declaration.test(content)) {
      violations.push(`${rel}: ${label} contract "${name}" must be defined in ${owner} only.`);
    }
  }
}

function checkForbiddenPackageRefs(rel, content, violations) {
  for (const ref of FORBIDDEN_PACKAGE_REFS) {
    if (content.includes(ref)) {
      violations.push(`${rel}: forbidden transitional package reference "${ref}".`);
    }
  }
}

function hasTypeOrInterfaceDeclaration(content) {
  return /^\s*(?:export\s+)?interface\s+\w+/m.test(content) || /^\s*(?:export\s+)?type\s+\w+\s*=/m.test(content);
}

function checkBffDependencyDirection(rel, content, file, root, violations) {
  const sourceLayer = getBffLayer(rel);
  if (!sourceLayer) return;

  for (const specifier of findImportSpecifiers(content)) {
    if (!specifier.startsWith('.')) continue;
    const targetRel = normalizePath(path.relative(root, path.resolve(path.dirname(file), specifier)));
    const targetLayer = getBffLayer(targetRel);
    if (!targetLayer || targetLayer === sourceLayer) continue;

    if (sourceLayer === 'application' && targetLayer === 'controller') {
      violations.push(`${rel}: application layer must not import controller (${specifier}).`);
    }
    if (sourceLayer === 'domain' && ['controller', 'application', 'infra', 'bootstrap'].includes(targetLayer)) {
      violations.push(`${rel}: domain layer must not import ${targetLayer} (${specifier}).`);
    }
    if (sourceLayer === 'infra' && ['controller', 'application', 'bootstrap'].includes(targetLayer)) {
      violations.push(`${rel}: infra layer must not import ${targetLayer} (${specifier}).`);
    }
    if (['common', 'constants'].includes(sourceLayer)) {
      if (['controller', 'application', 'domain', 'infra', 'bootstrap'].includes(targetLayer)) {
        violations.push(`${rel}: shared ${sourceLayer} layer must not import ${targetLayer} (${specifier}).`);
      }
    }
  }
}

function findImportSpecifiers(content) {
  const specifiers = [];
  const importPattern = /(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function findNamedImportsFrom(content, packageName) {
  const importedNames = [];
  const importPattern = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    if (match[2] !== packageName) continue;
    for (const rawName of match[1].split(',')) {
      const name = rawName.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
      if (name) importedNames.push(name);
    }
  }
  return importedNames;
}

function getBffLayer(rel) {
  const match = normalizePath(rel).match(/^packages\/bff\/src\/([^/]+)/);
  return match?.[1] ?? null;
}

function checkPackageManifest(file, root, violations) {
  const rel = normalizePath(path.relative(root, file));
  const packageName = getPackageName(rel);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dependencyBlocks = ['dependencies', 'devDependencies', 'peerDependencies'];

  for (const blockName of dependencyBlocks) {
    const block = manifest[blockName] ?? {};
    for (const dependencyName of Object.keys(block)) {
      if (FORBIDDEN_PACKAGE_REFS.includes(dependencyName)) {
        violations.push(`${rel}: forbidden transitional dependency "${dependencyName}" in ${blockName}.`);
      }
      if (packageName === 'bff' && FORBIDDEN_BFF_DEPS.includes(dependencyName)) {
        violations.push(`${rel}: BFF dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (packageName === 'query' && FORBIDDEN_QUERY_DEPS.includes(dependencyName)) {
        violations.push(`${rel}: query dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (packageName === 'permission' && FORBIDDEN_PERMISSION_DEPS.includes(dependencyName)) {
        violations.push(`${rel}: permission dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (packageName === 'kernel' && FORBIDDEN_KERNEL_DEPS.includes(dependencyName)) {
        violations.push(`${rel}: kernel dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (packageName === 'datasource' && FORBIDDEN_DATASOURCE_DEPS.includes(dependencyName)) {
        violations.push(`${rel}: datasource dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (packageName === 'audit' && FORBIDDEN_AUDIT_DEPS.includes(dependencyName)) {
        violations.push(`${rel}: audit dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (ALLOWED_APP_DEPS[packageName] && dependencyName.startsWith('@zhongmiao/meta-lc-') && !ALLOWED_APP_DEPS[packageName].has(dependencyName)) {
        violations.push(`${rel}: app dependency "${dependencyName}" is forbidden in ${blockName}.`);
      }
      if (!DB_DRIVER_DEPENDENCIES.has(dependencyName)) continue;
      if (!DB_DRIVER_PACKAGES.has(packageName)) {
        violations.push(
          `${rel}: ${dependencyName} is forbidden in ${blockName} outside audit/datasource/kernel packages.`
        );
      }
    }
  }
}

function importsPg(content) {
  return /from\s+["']pg["']/.test(content) || /require\(\s*["']pg["']\s*\)/.test(content);
}

function getPackageName(rel) {
  const match = rel.match(/^(?:packages|apps)\/([^/]+)\//);
  return match?.[1] ?? '';
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function main() {
  const violations = checkWorkspace();

  if (violations.length > 0) {
    console.error('Boundary violations found:');
    for (const v of violations) console.error(`- ${v}`);
    process.exit(1);
  }

  console.log('Boundary check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
