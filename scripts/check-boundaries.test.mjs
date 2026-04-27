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
    'packages/datasource/src/infra/postgres/postgres.adapter.ts': 'import { Pool } from "pg";\n',
    'packages/datasource/src/infra/postgres/postgres-org-scope.adapter.ts': 'import { Pool } from "pg";\n'
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
    'packages/query/package.json: pg is forbidden in dependencies outside audit/datasource/kernel packages.',
    'packages/query/package.json: @types/pg is forbidden in devDependencies outside audit/datasource/kernel packages.'
  ]);
});

test('rejects pg imports outside db-boundary packages', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/index.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/runtime/src/index.ts: direct pg import is forbidden outside audit/datasource/kernel packages.'
  ]);
});

test('rejects unapproved pg imports inside db-boundary packages', () => {
  const workspace = createWorkspace({
    'packages/bff/src/random-db-helper.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/random-db-helper.ts: unsupported BFF top-level source file.',
    'packages/bff/src/random-db-helper.ts: direct pg import is forbidden outside audit/datasource/kernel packages.',
    'packages/bff/src/random-db-helper.ts: BFF cannot depend on pg.'
  ]);
});

test('keeps deep import and kernel reverse dependency checks', () => {
  const workspace = createWorkspace({
    'packages/kernel/src/index.ts': [
      'import { x } from "@zhongmiao/meta-lc-query/src/index";',
      'import { y } from "@zhongmiao/meta-lc-bff";',
      'import { z } from "@zhongmiao/meta-lc-permission";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/index.ts: deep import from package internals is forbidden.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-bff.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-query.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-permission.'
  ]);
});

test('rejects removed transitional packages and references', () => {
  const workspace = createWorkspace({
    'packages/contracts/package.json': packageJson({
      dependencies: {}
    }),
    'packages/shared/src/index.ts': 'export const shared = true;\n',
    'packages/runtime/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-contracts': 'workspace:*',
        '@zhongmiao/meta-lc-shared': 'workspace:*',
        '@zhongmiao/meta-lc-platform': 'workspace:*',
        '@zhongmiao/meta-lc-migration': 'workspace:*'
      }
    }),
    'packages/runtime/src/bad.ts': 'import type { ViewDefinition } from "@zhongmiao/meta-lc-contracts";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/contracts: forbidden transitional package directory.',
    'packages/shared: forbidden transitional package directory.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-contracts" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-shared" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-platform" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-migration" in dependencies.',
    'packages/runtime/src/bad.ts: forbidden transitional package reference "@zhongmiao/meta-lc-contracts".'
  ]);
});

test('rejects demo artifacts in core packages and infra SQL', () => {
  const workspace = createWorkspace({
    'packages/kernel/src/domain/demo-meta-registry.ts': 'export const seed = true;\n',
    'packages/kernel/src/domain/index.ts': 'export * from "./demo-meta-registry";\n',
    'packages/datasource/src/infra/postgres/postgres-demo-orders-mutation.adapter.ts': 'import { Pool } from "pg";\n',
    'infra/sql/001_orders_demo.sql': 'SELECT 1;\n',
    'packages/runtime/src/index.ts': 'import { seed } from "../../../examples/orders-demo/meta-registry";\n',
    'packages/runtime/src/example.ts': 'export const sql = "001_orders_demo.sql";\n',
    'packages/datasource/src/infra/postgres/orders.adapter.ts': 'export const table = "orders";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/domain/demo-meta-registry.ts: demo artifacts must live under examples/orders-demo.',
    'packages/datasource/src/infra/postgres/postgres-demo-orders-mutation.adapter.ts: demo artifacts must live under examples/orders-demo.',
    'infra/sql/001_orders_demo.sql: demo artifacts must live under examples/orders-demo.',
    'packages/datasource/src/infra/postgres/orders.adapter.ts: datasource source must stay business-generic and must not reference orders.',
    'packages/datasource/src/infra/postgres/postgres-demo-orders-mutation.adapter.ts: demo source must live under examples/orders-demo.',
    'packages/datasource/src/infra/postgres/postgres-demo-orders-mutation.adapter.ts: direct pg import is not allowed here.',
    'packages/kernel/src/domain/demo-meta-registry.ts: demo source must live under examples/orders-demo.',
    'packages/kernel/src/domain/index.ts: core package source must not reference demo-owned artifacts.',
    'packages/runtime/src/example.ts: core package source must not reference demo-owned artifacts.',
    'packages/runtime/src/index.ts: core package source must not reference demo-owned artifacts.',
    'packages/runtime/src/index.ts: packages/apps must not import examples (../../../examples/orders-demo/meta-registry).'
  ]);
});

test('rejects legacy BFF application/interface/types directories and unsupported top-level dirs', () => {
  const workspace = createWorkspace({
    'packages/bff/src/application/services/.gitkeep': '',
    'packages/bff/src/domain/.gitkeep': '',
    'packages/bff/src/mapper/.gitkeep': '',
    'packages/bff/src/interface/.gitkeep': '',
    'packages/bff/src/types/.gitkeep': '',
    'packages/bff/src/infra/repository/.gitkeep': '',
    'packages/bff/src/infra/interfaces/.gitkeep': '',
    'packages/bff/src/gateway/query.controller.ts': 'export class QueryController {}\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/application: forbidden BFF source directory.',
    'packages/bff/src/domain: forbidden BFF source directory.',
    'packages/bff/src/mapper: forbidden BFF source directory.',
    'packages/bff/src/infra/interfaces: forbidden BFF source directory.',
    'packages/bff/src/infra/repository: forbidden BFF source directory.',
    'packages/bff/src/interface: forbidden BFF source directory.',
    'packages/bff/src/types: forbidden BFF source directory.',
    'packages/bff/src/gateway: unsupported BFF top-level source directory.',
    'packages/bff/src/infra/interfaces: unsupported BFF infra directory.',
    'packages/bff/src/infra/repository: unsupported BFF infra directory.'
  ]);
});

test('rejects unsupported BFF infra directories', () => {
  const workspace = createWorkspace({
    'packages/bff/src/infra/cache/cache.service.ts': 'export class CacheService {}\n',
    'packages/bff/src/infra/integration/meta-registry.service.ts': 'export class MetaRegistryService {}\n',
    'packages/bff/src/infra/datasource/bad.ts': 'export const bad = true;\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/infra/datasource: unsupported BFF infra directory.'
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
    'packages/bff/src/controller/http/bad.service.ts': [
      'import { compileViewDefinition, executeQueryNode } from "@zhongmiao/meta-lc-runtime";',
      'export class QueryOrchestratorService {}',
      'export class TemporaryViewAdapter {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/controller/http/bad.service.ts: legacy BFF orchestrator symbol "QueryOrchestrator" is forbidden.',
    'packages/bff/src/controller/http/bad.service.ts: legacy BFF orchestrator symbol "QueryOrchestratorService" is forbidden.',
    'packages/bff/src/controller/http/bad.service.ts: legacy BFF orchestrator symbol "TemporaryViewAdapter" is forbidden.',
    'packages/bff/src/controller/http/bad.service.ts: BFF must call runtime facade instead of importing compileViewDefinition.',
    'packages/bff/src/controller/http/bad.service.ts: BFF must call runtime facade instead of importing executeQueryNode.',
    'packages/bff/src/controller/http/query.controller.ts: legacy /query and /mutation endpoints are forbidden.'
  ]);
});

test('rejects misplaced structure and execution contract definitions', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/types/shared.types.ts': [
      'export interface ViewDefinition {}',
      'export type ExecutionPlan = {}'
    ].join('\n'),
    'packages/kernel/src/types/shared.types.ts': [
      'export interface ViewDefinition {}',
      'export type ExecutionPlan = {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/types/shared.types.ts: execution contract "ExecutionPlan" must be defined in packages/runtime only.',
    'packages/runtime/src/types/shared.types.ts: structure contract "ViewDefinition" must be defined in packages/kernel only.'
  ]);
});

test('rejects runtime orchestrator directory and migration package', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/application/orchestrator/runtime.orchestrator.ts': 'export const x = 1;\n',
    'packages/migration/package.json': packageJson({ dependencies: {} })
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/migration: forbidden transitional package directory.',
    'packages/runtime/src/application/orchestrator: forbidden runtime source directory.'
  ]);
});

test('rejects BFF type/interface mixing and implementation-local declarations', () => {
  const workspace = createWorkspace({
    'packages/bff/src/controller/http/bad.interface.ts': 'export type Bad = {};\n',
    'packages/bff/src/controller/http/bad.type.ts': 'export interface Bad {}\n',
    'packages/bff/src/controller/http/bad.service.ts': 'interface Bad {}\nexport class BadService {}\n',
    'packages/bff/src/dto/bad.dto.ts': 'export type BadDto = {};\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/dto: unsupported BFF top-level source directory.',
    'packages/bff/src/controller/http/bad.interface.ts: *.interface.ts files may not export type declarations.',
    'packages/bff/src/controller/http/bad.service.ts: TypeScript type/interface declarations must live in a *.type.ts or *.interface.ts file.',
    'packages/bff/src/controller/http/bad.type.ts: *.type.ts files may not export interface declarations.',
    'packages/bff/src/dto/bad.dto.ts: TypeScript type/interface declarations must live in a *.type.ts or *.interface.ts file.',
    'packages/bff/src/dto/bad.dto.ts: BFF dto files must be class-only.'
  ]);
});

test('rejects removed BFF contracts directory', () => {
  const workspace = createWorkspace({
    'packages/bff/src/contracts/types/index.ts': 'export type { QueryInput } from "./query.type";\n',
    'packages/bff/src/contracts/interfaces/index.ts': 'export { QueryService } from "./query.interface";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/contracts: forbidden BFF source directory.',
    'packages/bff/src/contracts/interfaces/index.ts: type/interface index aggregators are forbidden in BFF.',
    'packages/bff/src/contracts/types/index.ts: type/interface index aggregators are forbidden in BFF.'
  ]);
});

test('rejects BFF data dependencies while allowing thin controller-to-infra delegation', () => {
  const workspace = createWorkspace({
    'packages/bff/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-datasource': 'workspace:*',
        '@zhongmiao/meta-lc-permission': 'workspace:*',
        '@zhongmiao/meta-lc-query': 'workspace:*',
        '@zhongmiao/meta-lc-audit': 'workspace:*',
        pg: '^8.13.1'
      },
      devDependencies: {
        '@types/pg': '^8.11.10'
      }
    }),
    'packages/bff/src/controller/http/query.controller.ts': 'import { Db } from "../../infra/integration/db";\n',
    'packages/bff/src/controller/http/bad.ts': [
      'import { Pool } from "pg";',
      'import { x } from "@zhongmiao/meta-lc-datasource";',
      'import { y } from "@zhongmiao/meta-lc-permission";',
      'import { z } from "@zhongmiao/meta-lc-query";',
      'import { a } from "@zhongmiao/meta-lc-audit";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-datasource" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-permission" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-query" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-audit" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "pg" is forbidden in dependencies.',
    'packages/bff/package.json: pg is forbidden in dependencies outside audit/datasource/kernel packages.',
    'packages/bff/package.json: BFF dependency "@types/pg" is forbidden in devDependencies.',
    'packages/bff/package.json: @types/pg is forbidden in devDependencies outside audit/datasource/kernel packages.',
    'packages/bff/src/controller/http/bad.ts: direct pg import is forbidden outside audit/datasource/kernel packages.',
    'packages/bff/src/controller/http/bad.ts: BFF cannot depend on @zhongmiao/meta-lc-datasource.',
    'packages/bff/src/controller/http/bad.ts: BFF cannot depend on @zhongmiao/meta-lc-permission.',
    'packages/bff/src/controller/http/bad.ts: BFF cannot depend on @zhongmiao/meta-lc-query.',
    'packages/bff/src/controller/http/bad.ts: BFF cannot depend on @zhongmiao/meta-lc-audit.',
    'packages/bff/src/controller/http/bad.ts: BFF cannot depend on pg.'
  ]);
});

test('allows gateway-only BFF config and rejects data config keywords', () => {
  const allowed = createWorkspace({
    'packages/bff/src/config/gateway.config.ts': [
      'export function readGatewayPort() { return process.env.PORT ?? "6001"; }',
      'export function readGatewayRequestIdHeader() { return process.env.LC_BFF_REQUEST_ID_HEADER ?? "x-request-id"; }',
      'export function readGatewayRuntimeWsPath() { return process.env.LC_RUNTIME_WS_PATH ?? "/runtime"; }'
    ].join('\n')
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/bff/src/config/gateway.config.ts': 'export const bad = process.env.LC_DB_HOST ?? "localhost";\n'
  });
  assert.deepEqual(checkWorkspace(rejected), [
    'packages/bff/src/config/gateway.config.ts: BFF gateway config may not read DB/data/runtime execution settings.'
  ]);
});

test('keeps BFF meta registry as a kernel-only gateway', () => {
  const workspace = createWorkspace({
    'packages/bff/src/infra/integration/meta-registry.service.ts': [
      'import { executeRuntimeGatewayView } from "@zhongmiao/meta-lc-runtime";',
      'export class MetaRegistryService {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/infra/integration/meta-registry.service.ts: BFF meta registry gateway may only depend on kernel.'
  ]);
});

test('rejects final app and package dependency direction violations', () => {
  const workspace = createWorkspace({
    'apps/bff-server/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-bff': 'workspace:*',
        '@zhongmiao/meta-lc-runtime': 'workspace:*'
      }
    }),
    'apps/bff-server/src/main.ts': 'import { RuntimeExecutor } from "@zhongmiao/meta-lc-runtime";\n',
    'packages/kernel/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-permission': 'workspace:*'
      }
    }),
    'packages/query/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-runtime': 'workspace:*',
        '@zhongmiao/meta-lc-permission': 'workspace:*'
      }
    }),
    'packages/permission/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-query': 'workspace:*',
        '@zhongmiao/meta-lc-runtime': 'workspace:*'
      }
    })
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/package.json: kernel dependency "@zhongmiao/meta-lc-permission" is forbidden in dependencies.',
    'packages/permission/package.json: permission dependency "@zhongmiao/meta-lc-runtime" is forbidden in dependencies.',
    'packages/query/package.json: query dependency "@zhongmiao/meta-lc-runtime" is forbidden in dependencies.',
    'packages/query/package.json: query dependency "@zhongmiao/meta-lc-permission" is forbidden in dependencies.',
    'apps/bff-server/package.json: app dependency "@zhongmiao/meta-lc-runtime" is forbidden in dependencies.',
    'apps/bff-server/src/main.ts: bff-server app can only depend on @zhongmiao/meta-lc-bff.'
  ]);
});

test('rejects datasource and audit reverse workspace dependencies', () => {
  const workspace = createWorkspace({
    'packages/datasource/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-runtime': 'workspace:*',
        '@zhongmiao/meta-lc-query': 'workspace:*',
        '@zhongmiao/meta-lc-permission': 'workspace:*',
        '@zhongmiao/meta-lc-bff': 'workspace:*',
        '@zhongmiao/meta-lc-audit': 'workspace:*'
      }
    }),
    'packages/datasource/src/bad.ts': [
      'import { RuntimeExecutor } from "@zhongmiao/meta-lc-runtime";',
      'import { compileSelectAst } from "@zhongmiao/meta-lc-query";',
      'import { transformSelectQueryAstWithPermission } from "@zhongmiao/meta-lc-permission";',
      'import { startBffServer } from "@zhongmiao/meta-lc-bff";',
      'import { AuditService } from "@zhongmiao/meta-lc-audit";'
    ].join('\n'),
    'packages/audit/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-runtime': 'workspace:*',
        '@zhongmiao/meta-lc-bff': 'workspace:*',
        '@zhongmiao/meta-lc-query': 'workspace:*',
        '@zhongmiao/meta-lc-permission': 'workspace:*',
        '@zhongmiao/meta-lc-datasource': 'workspace:*'
      }
    }),
    'packages/audit/src/bad.ts': [
      'import { RuntimeExecutor } from "@zhongmiao/meta-lc-runtime";',
      'import { startBffServer } from "@zhongmiao/meta-lc-bff";',
      'import { compileSelectAst } from "@zhongmiao/meta-lc-query";',
      'import { transformSelectQueryAstWithPermission } from "@zhongmiao/meta-lc-permission";',
      'import { PostgresDatasourceAdapter } from "@zhongmiao/meta-lc-datasource";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/audit/package.json: audit dependency "@zhongmiao/meta-lc-runtime" is forbidden in dependencies.',
    'packages/audit/package.json: audit dependency "@zhongmiao/meta-lc-bff" is forbidden in dependencies.',
    'packages/audit/package.json: audit dependency "@zhongmiao/meta-lc-query" is forbidden in dependencies.',
    'packages/audit/package.json: audit dependency "@zhongmiao/meta-lc-permission" is forbidden in dependencies.',
    'packages/audit/package.json: audit dependency "@zhongmiao/meta-lc-datasource" is forbidden in dependencies.',
    'packages/audit/src/bad.ts: audit cannot depend on @zhongmiao/meta-lc-runtime.',
    'packages/audit/src/bad.ts: audit cannot depend on @zhongmiao/meta-lc-bff.',
    'packages/audit/src/bad.ts: audit cannot depend on @zhongmiao/meta-lc-query.',
    'packages/audit/src/bad.ts: audit cannot depend on @zhongmiao/meta-lc-permission.',
    'packages/audit/src/bad.ts: audit cannot depend on @zhongmiao/meta-lc-datasource.',
    'packages/datasource/package.json: datasource dependency "@zhongmiao/meta-lc-runtime" is forbidden in dependencies.',
    'packages/datasource/package.json: datasource dependency "@zhongmiao/meta-lc-query" is forbidden in dependencies.',
    'packages/datasource/package.json: datasource dependency "@zhongmiao/meta-lc-permission" is forbidden in dependencies.',
    'packages/datasource/package.json: datasource dependency "@zhongmiao/meta-lc-bff" is forbidden in dependencies.',
    'packages/datasource/package.json: datasource dependency "@zhongmiao/meta-lc-audit" is forbidden in dependencies.',
    'packages/datasource/src/bad.ts: datasource cannot depend on @zhongmiao/meta-lc-runtime.',
    'packages/datasource/src/bad.ts: datasource cannot depend on @zhongmiao/meta-lc-query.',
    'packages/datasource/src/bad.ts: datasource cannot depend on @zhongmiao/meta-lc-permission.',
    'packages/datasource/src/bad.ts: datasource cannot depend on @zhongmiao/meta-lc-bff.',
    'packages/datasource/src/bad.ts: datasource cannot depend on @zhongmiao/meta-lc-audit.'
  ]);
});

test('rejects runtime manager adapter and manager event test naming', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/application/manager-adapter.ts': 'export const bad = true;\n',
    'packages/runtime/test/runtime-manager-event.test.ts': 'import test from "node:test";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/runtime/src/application/manager-adapter.ts: runtime manager-adapter references are forbidden.',
    'packages/runtime/test/runtime-manager-event.test.ts: runtime manager event test naming is forbidden; use runtime-interaction-event.test.ts.'
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
