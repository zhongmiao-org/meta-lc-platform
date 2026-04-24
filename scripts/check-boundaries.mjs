import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_DRIVER_PACKAGES = new Set(['bff', 'datasource', 'kernel']);
const DB_DRIVER_DEPENDENCIES = new Set(['pg', '@types/pg']);
const ALLOWED_PG_IMPORT_FILES = new Set([
  'packages/datasource/src/infra/postgres/postgres.adapter.ts',
  'packages/kernel/src/infra/persistence/postgres-meta-kernel-repository.ts',
  'packages/bff/src/infra/integration/org-scope.service.ts',
  'packages/bff/src/infra/integration/audit-persistence.service.ts',
  'packages/bff/src/infra/integration/postgres-query-executor.service.ts',
  'packages/bff/src/interface/bootstrap/migration-runner.ts'
]);
const FORBIDDEN_KERNEL_DEPS = [
  '@zhongmiao/meta-lc-bff',
  '@zhongmiao/meta-lc-query',
  '@zhongmiao/meta-lc-datasource'
];

export function checkWorkspace(root = process.cwd()) {
  const packagesDir = path.join(root, 'packages');
  const violations = [];
  walk(packagesDir, root, violations);
  return violations;
}

function walk(dir, root, violations) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

function checkSourceFile(file, root, violations) {
  const rel = normalizePath(path.relative(root, file));
  const content = fs.readFileSync(file, 'utf8');

  // No deep cross-package imports.
  const deepImport = content.match(/from\s+["'](?:@meta-lc\/[a-z-]+|@zhongmiao\/meta-lc-[a-z-]+)\//g);
  if (deepImport) {
    violations.push(`${rel}: deep import from package internals is forbidden.`);
  }

  // DB driver access is a hard boundary: only explicit DB edge files may import pg.
  if (importsPg(content)) {
    const packageName = getPackageName(rel);
    if (!DB_DRIVER_PACKAGES.has(packageName)) {
      violations.push(`${rel}: direct pg import is forbidden outside bff/datasource/kernel packages.`);
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
}

function checkPackageManifest(file, root, violations) {
  const rel = normalizePath(path.relative(root, file));
  const packageName = getPackageName(rel);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dependencyBlocks = ['dependencies', 'devDependencies'];

  for (const blockName of dependencyBlocks) {
    const block = manifest[blockName] ?? {};
    for (const dependencyName of Object.keys(block)) {
      if (!DB_DRIVER_DEPENDENCIES.has(dependencyName)) continue;
      if (!DB_DRIVER_PACKAGES.has(packageName)) {
        violations.push(
          `${rel}: ${dependencyName} is forbidden in ${blockName} outside bff/datasource/kernel packages.`
        );
      }
    }
  }
}

function importsPg(content) {
  return /from\s+["']pg["']/.test(content) || /require\(\s*["']pg["']\s*\)/.test(content);
}

function getPackageName(rel) {
  const match = rel.match(/^packages\/([^/]+)\//);
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
