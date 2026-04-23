import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkWorkspace } from './check-boundaries.mjs';

test('allows current explicit pg edge files', () => {
  const workspace = createWorkspace({
    'packages/datasource/package.json': packageJson({
      dependencies: { pg: '^8.13.1' },
      devDependencies: { '@types/pg': '^8.11.10' }
    }),
    'packages/datasource/src/infra/postgres/postgres.adapter.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), []);
});

test('rejects pg declarations in non-db-boundary package manifests', () => {
  const workspace = createWorkspace({
    'packages/query/package.json': packageJson({
      dependencies: { pg: '^8.13.1' },
      devDependencies: { '@types/pg': '^8.11.10' }
    })
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/query/package.json: pg is forbidden in dependencies outside bff/datasource/kernel packages.',
    'packages/query/package.json: @types/pg is forbidden in devDependencies outside bff/datasource/kernel packages.'
  ]);
});

test('rejects pg imports outside db-boundary packages', () => {
  const workspace = createWorkspace({
    'packages/audit/src/index.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/audit/src/index.ts: direct pg import is forbidden outside bff/datasource/kernel packages.'
  ]);
});

test('rejects unapproved pg imports inside db-boundary packages', () => {
  const workspace = createWorkspace({
    'packages/bff/src/random-db-helper.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/random-db-helper.ts: direct pg import is not allowed here.'
  ]);
});

test('keeps deep import and kernel reverse dependency checks', () => {
  const workspace = createWorkspace({
    'packages/kernel/src/index.ts': [
      'import { x } from "@zhongmiao/meta-lc-query/src/index";',
      'import { y } from "@zhongmiao/meta-lc-bff";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/index.ts: deep import from package internals is forbidden.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-bff.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-query.'
  ]);
});

function createWorkspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-lc-boundaries-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

function packageJson(content) {
  return `${JSON.stringify({ name: 'test-package', ...content }, null, 2)}\n`;
}
