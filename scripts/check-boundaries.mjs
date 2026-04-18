import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGES = path.join(ROOT, 'packages');
const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') continue;
      walk(full);
      continue;
    }
    if (entry.isFile() && full.endsWith('.ts')) checkFile(full);
  }
}

function checkFile(file) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');

  // No deep cross-package imports.
  const deepImport = content.match(/from\s+["']@meta-lc\/[a-z-]+\//g);
  if (deepImport) {
    violations.push(`${rel}: deep import from package internals is forbidden.`);
  }

  // Transitional guard: DB driver should be centralized and explicitly allowlisted.
  if (content.includes("from \"pg\"") || content.includes("from 'pg'")) {
    const allowed = [
      'packages/datasource/src/postgres-datasource-adapter.ts',
      'packages/kernel/src/postgres-meta-kernel-repository.ts',
      'packages/bff/src/integration/org-scope.service.ts',
      'packages/bff/src/integration/audit-persistence.service.ts',
      'packages/bff/src/integration/postgres-query-executor.service.ts',
      'packages/bff/src/bootstrap/migration-runner.ts'
    ];
    if (!allowed.includes(rel)) {
      violations.push(`${rel}: direct pg import is not allowed here.`);
    }
  }

  // Kernel must not depend on bff/query/datasource implementation.
  if (rel.startsWith('packages/kernel/')) {
    const forbidden = [
      '@zhongmiao/meta-lc-bff',
      '@zhongmiao/meta-lc-query',
      '@zhongmiao/meta-lc-datasource'
    ];
    for (const dep of forbidden) {
      if (content.includes(dep)) {
        violations.push(`${rel}: kernel cannot depend on ${dep}.`);
      }
    }
  }
}

walk(PACKAGES);

if (violations.length > 0) {
  console.error('Boundary violations found:');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log('Boundary check passed.');
