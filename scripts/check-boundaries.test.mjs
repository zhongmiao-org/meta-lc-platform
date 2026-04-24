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
    'packages/bff/src/random-db-helper.ts: unsupported BFF top-level source file.',
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

test('rejects legacy BFF interface/types directories and unsupported top-level dirs', () => {
  const workspace = createWorkspace({
    'packages/bff/src/application/orchestrator/.gitkeep': '',
    'packages/bff/src/interface/.gitkeep': '',
    'packages/bff/src/types/.gitkeep': '',
    'packages/bff/src/gateway/query.controller.ts': 'export class QueryController {}\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/application/orchestrator: forbidden BFF source directory.',
    'packages/bff/src/interface: forbidden BFF source directory.',
    'packages/bff/src/types: forbidden BFF source directory.',
    'packages/bff/src/gateway: unsupported BFF top-level source directory.'
  ]);
});

test('rejects legacy BFF query/mutation orchestration surfaces', () => {
  const workspace = createWorkspace({
    'packages/bff/src/controller/http/query.controller.ts': [
      'import { Post } from "@nestjs/common";',
      'export class QueryController {',
      '  @Post("query") query() {}',
      '}'
    ].join('\n'),
    'packages/bff/src/application/services/bad.service.ts': [
      'import { compileViewDefinition, executeQueryNode } from "@zhongmiao/meta-lc-runtime";',
      'export class QueryOrchestratorService {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/application/services/bad.service.ts: legacy BFF orchestrator symbol "QueryOrchestrator" is forbidden.',
    'packages/bff/src/application/services/bad.service.ts: legacy BFF orchestrator symbol "QueryOrchestratorService" is forbidden.',
    'packages/bff/src/application/services/bad.service.ts: BFF must call runtime facade instead of importing compileViewDefinition.',
    'packages/bff/src/application/services/bad.service.ts: BFF must call runtime facade instead of importing executeQueryNode.',
    'packages/bff/src/controller/http/query.controller.ts: legacy /query and /mutation endpoints are forbidden.'
  ]);
});

test('rejects V2 core contract definitions outside contracts', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/types/shared.types.ts': [
      'export interface ViewDefinition {}',
      'export type ExecutionPlan = {}'
    ].join('\n'),
    'packages/contracts/src/index.ts': [
      'export interface ViewDefinition {}',
      'export type ExecutionPlan = {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/runtime/src/types/shared.types.ts: V2 core contract "ViewDefinition" must be defined in packages/contracts only.',
    'packages/runtime/src/types/shared.types.ts: V2 core contract "ExecutionPlan" must be defined in packages/contracts only.'
  ]);
});

test('rejects BFF type/interface mixing and implementation-local declarations', () => {
  const workspace = createWorkspace({
    'packages/bff/src/contracts/interfaces/bad.interface.ts': 'export type Bad = {};\n',
    'packages/bff/src/contracts/types/bad.type.ts': 'export interface Bad {}\n',
    'packages/bff/src/application/services/bad.service.ts': 'interface Bad {}\nexport class BadService {}\n',
    'packages/bff/src/dto/bad.dto.ts': 'export type BadDto = {};\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/application/services/bad.service.ts: TypeScript type/interface declarations must live in a *.type.ts or *.interface.ts file.',
    'packages/bff/src/contracts/interfaces/bad.interface.ts: *.interface.ts files may not export type declarations.',
    'packages/bff/src/contracts/types/bad.type.ts: *.type.ts files may not export interface declarations.',
    'packages/bff/src/dto/bad.dto.ts: TypeScript type/interface declarations must live in a *.type.ts or *.interface.ts file.',
    'packages/bff/src/dto/bad.dto.ts: BFF dto files must be class-only.'
  ]);
});

test('rejects BFF type and interface index aggregators', () => {
  const workspace = createWorkspace({
    'packages/bff/src/application/types/index.ts': 'export type { QueryInput } from "./query.type";\n',
    'packages/bff/src/application/interfaces/index.ts': 'export { QueryService } from "./query.interface";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/application/interfaces/index.ts: type/interface index aggregators are forbidden in BFF.',
    'packages/bff/src/application/types/index.ts: type/interface index aggregators are forbidden in BFF.'
  ]);
});

test('rejects controller-to-infra and shared-layer reverse imports in BFF', () => {
  const workspace = createWorkspace({
    'packages/bff/src/controller/http/query.controller.ts': 'import { Db } from "../../infra/integration/db";\n',
    'packages/bff/src/contracts/types/bad.type.ts': 'import { QueryController } from "../../controller/http/query.controller";\nexport type Bad = {};\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/contracts/types/bad.type.ts: shared contracts layer must not import controller (../../controller/http/query.controller).',
    'packages/bff/src/controller/http/query.controller.ts: controller layer must not import infra directly (../../infra/integration/db).'
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
