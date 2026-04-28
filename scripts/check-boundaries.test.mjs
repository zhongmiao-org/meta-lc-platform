import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkWorkspace } from './check-boundaries.mjs';

test('allows current explicit pg edge files', () => {
  const workspace = createWorkspace({
    'packages/datasource/package.json': packageJson({
      devDependencies: { pg: '^8.13.1', '@types/pg': '^8.11.10' },
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } }
    }),
    'packages/audit/package.json': packageJson({
      devDependencies: { pg: '^8.13.1', '@types/pg': '^8.11.10' },
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } }
    }),
    'packages/datasource/src/postgres/postgres.adapter.ts': 'import { Pool } from "pg";\n',
    'packages/datasource/src/postgres/postgres-org-scope.adapter.ts': 'import { Pool } from "pg";\n',
    'packages/audit/src/postgres/postgres-runtime-audit.sink.ts': 'import { Pool } from "pg";\n'
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
    'packages/query/package.json: pg is forbidden in dependencies outside audit/datasource/kernel-adapter-postgres packages.',
    'packages/query/package.json: @types/pg is forbidden in devDependencies outside audit/datasource/kernel-adapter-postgres packages.'
  ]);
});

test('keeps audit and datasource pg dependencies as optional peers', () => {
  const workspace = createWorkspace({
    'packages/datasource/package.json': packageJson({
      dependencies: { pg: '^8.13.1' },
      devDependencies: { '@types/pg': '^8.11.10' }
    }),
    'packages/audit/package.json': packageJson({
      devDependencies: { pg: '^8.13.1', '@types/pg': '^8.11.10' },
      peerDependencies: { pg: '^8.13.1' }
    })
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/audit/package.json: postgres secondary entry packages must mark peerDependenciesMeta.pg.optional as true.',
    'packages/datasource/package.json: pg must be an optional peerDependency for postgres secondary entries, not a dependency.',
    'packages/datasource/package.json: postgres secondary entry packages must declare pg in peerDependencies.',
    'packages/datasource/package.json: postgres secondary entry packages must mark peerDependenciesMeta.pg.optional as true.'
  ]);
});

test('rejects pg imports outside db-boundary packages', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/index.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/runtime/src/index.ts: direct pg import is forbidden outside audit/datasource/kernel-adapter-postgres packages.'
  ]);
});

test('rejects unapproved pg imports inside db-boundary packages', () => {
  const workspace = createWorkspace({
    'packages/bff/src/random-db-helper.ts': 'import { Pool } from "pg";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/random-db-helper.ts: unsupported BFF top-level source file.',
    'packages/bff/src/random-db-helper.ts: direct pg import is forbidden outside audit/datasource/kernel-adapter-postgres packages.',
    'packages/bff/src/random-db-helper.ts: BFF cannot depend on pg.'
  ]);
});

test('allows kernel-adapter-postgres as the only kernel postgres integration edge', () => {
  const allowed = createWorkspace({
    'packages/kernel-adapter-postgres/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel': 'workspace:*',
        pg: '^8.13.1'
      },
      devDependencies: {
        '@types/pg': '^8.11.10'
      }
    }),
    'packages/kernel-adapter-postgres/src/postgres/postgres-meta-kernel-repository.ts': [
      'import { Pool } from "pg";',
      'import type { MetaKernelRepositoryPort } from "@zhongmiao/meta-lc-kernel";'
    ].join('\n')
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/kernel/package.json': packageJson({
      dependencies: {
        pg: '^8.13.1'
      }
    }),
    'packages/kernel/src/infra/postgres.ts': 'import { Pool } from "pg";\n',
    'packages/kernel-adapter-postgres/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel': 'workspace:*',
        '@zhongmiao/meta-lc-runtime': 'workspace:*'
      }
    }),
    'packages/kernel-adapter-postgres/src/bad.ts': 'import { RuntimeExecutor } from "@zhongmiao/meta-lc-runtime";\n'
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/kernel/package.json: pg is forbidden in dependencies outside audit/datasource/kernel-adapter-postgres packages.',
    'packages/kernel/src/infra/postgres.ts: direct pg import is forbidden outside audit/datasource/kernel-adapter-postgres packages.',
    'packages/kernel-adapter-postgres/package.json: kernel-adapter-postgres dependency "@zhongmiao/meta-lc-runtime" is forbidden in dependencies.',
    'packages/kernel-adapter-postgres/src/bad.ts: kernel-adapter-postgres cannot depend on @zhongmiao/meta-lc-runtime.'
  ]);
});

test('keeps deep import and kernel reverse dependency checks', () => {
  const workspace = createWorkspace({
    'packages/kernel/src/index.ts': [
      'import { x } from "@zhongmiao/meta-lc-query/src/index";',
      'import { y } from "@zhongmiao/meta-lc-bff";',
      'import { z } from "@zhongmiao/meta-lc-permission";'
    ].join('\n'),
    'apps/bff-server/src/main.ts': [
      'import { startBffServer } from "@zhongmiao/meta-lc-bff";',
      'import { createPostgresDatasourceAdapter } from "@zhongmiao/meta-lc-datasource/postgres";',
      'import { PostgresRuntimeAuditSink } from "@zhongmiao/meta-lc-audit/postgres";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/index.ts: deep import from package internals is forbidden (@zhongmiao/meta-lc-query/src/index).',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-bff.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-query.',
    'packages/kernel/src/index.ts: kernel cannot depend on @zhongmiao/meta-lc-permission.'
  ]);
});

test('rejects package deep imports while allowing approved secondary entries', () => {
  const allowed = createWorkspace({
    'apps/bff-server/src/main.ts': [
      'import { createPostgresDatasourceAdapter } from "@zhongmiao/meta-lc-datasource/postgres";',
      'import { PostgresRuntimeAuditSink } from "@zhongmiao/meta-lc-audit/postgres";'
    ].join('\n')
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/runtime/src/bad.ts': [
      'import { RuntimeExecutor } from "@zhongmiao/meta-lc-runtime/application/executor/runtime-executor";',
      'import { compileSelectAst } from "@zhongmiao/meta-lc-query/src/index";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/runtime/src/bad.ts: deep import from package internals is forbidden (@zhongmiao/meta-lc-runtime/application/executor/runtime-executor).'
  ]);
});

test('keeps package exports limited to approved public entrypoints', () => {
  const allowed = createWorkspace({
    'packages/query/package.json': packageJson({
      exports: {
        '.': {
          types: './dist/index.d.ts',
          default: './dist/index.js'
        }
      }
    }),
    'packages/datasource/package.json': packageJson({
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } },
      exports: {
        '.': {
          types: './dist/index.d.ts',
          default: './dist/index.js'
        },
        './postgres': {
          types: './dist/postgres/index.d.ts',
          default: './dist/postgres/index.js'
        }
      }
    })
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/runtime/package.json': packageJson({
      exports: {
        '.': './dist/index.js',
        './src/*': './dist/src/*.js',
        './infra': './dist/infra/index.js',
        './postgres': './dist/postgres/index.js',
        './application/runtime': './dist/application/runtime.js'
      }
    })
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/runtime/package.json: package exports must not expose source paths (./src/*).',
    'packages/runtime/package.json: package export "./src/*" is not an approved public entrypoint.',
    'packages/runtime/package.json: package exports must not expose infra (./infra).',
    'packages/runtime/package.json: package export "./infra" is not an approved public entrypoint.',
    'packages/runtime/package.json: postgres secondary entry is only allowed for audit/datasource packages.',
    'packages/runtime/package.json: package export "./postgres" is not an approved public entrypoint.',
    'packages/runtime/package.json: package export "./application/runtime" is not an approved public entrypoint.'
  ]);
});

test('rejects removed transitional packages and references', () => {
  const workspace = createWorkspace({
    'packages/contracts/package.json': packageJson({
      dependencies: {}
    }),
    'packages/infra-persistence/package.json': packageJson({
      dependencies: {}
    }),
    'packages/shared/src/index.ts': 'export const shared = true;\n',
    'packages/runtime/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-contracts': 'workspace:*',
        '@zhongmiao/meta-lc-shared': 'workspace:*',
        '@zhongmiao/meta-lc-platform': 'workspace:*',
        '@zhongmiao/meta-lc-migration': 'workspace:*',
        '@zhongmiao/meta-lc-infra-persistence': 'workspace:*'
      }
    }),
    'packages/runtime/src/bad.ts': [
      'import type { ViewDefinition } from "@zhongmiao/meta-lc-contracts";',
      'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-infra-persistence";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/contracts: forbidden transitional package directory.',
    'packages/shared: forbidden transitional package directory.',
    'packages/infra-persistence: forbidden transitional package directory.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-contracts" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-shared" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-platform" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-migration" in dependencies.',
    'packages/runtime/package.json: forbidden transitional dependency "@zhongmiao/meta-lc-infra-persistence" in dependencies.',
    'packages/runtime/src/bad.ts: forbidden transitional package reference "@zhongmiao/meta-lc-contracts".',
    'packages/runtime/src/bad.ts: forbidden transitional package reference "@zhongmiao/meta-lc-infra-persistence".'
  ]);
});

test('rejects demo artifacts in core packages and infra SQL', () => {
  const workspace = createWorkspace({
    'packages/kernel/src/domain/demo-meta-registry.ts': 'export const seed = true;\n',
    'packages/kernel/src/domain/index.ts': 'export * from "./demo-meta-registry";\n',
    'packages/datasource/src/postgres/postgres-demo-orders-mutation.adapter.ts': 'import { Pool } from "pg";\n',
    'infra/sql/001_orders_demo.sql': 'SELECT 1;\n',
    'packages/runtime/src/index.ts': 'import { seed } from "../../../examples/orders-demo/meta-registry";\n',
    'packages/runtime/src/example.ts': 'export const sql = "001_orders_demo.sql";\n',
    'packages/datasource/src/postgres/orders.adapter.ts': 'export const table = "orders";\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/domain/demo-meta-registry.ts: demo artifacts must live under examples/orders-demo.',
    'packages/datasource/src/postgres/postgres-demo-orders-mutation.adapter.ts: demo artifacts must live under examples/orders-demo.',
    'infra/sql/001_orders_demo.sql: demo artifacts must live under examples/orders-demo.',
    'packages/datasource/src/postgres/orders.adapter.ts: datasource source must stay business-generic and must not reference orders.',
    'packages/datasource/src/postgres/postgres-demo-orders-mutation.adapter.ts: demo source must live under examples/orders-demo.',
    'packages/datasource/src/postgres/postgres-demo-orders-mutation.adapter.ts: direct pg import is not allowed here.',
    'packages/kernel/src/domain/demo-meta-registry.ts: demo source must live under examples/orders-demo.',
    'packages/kernel/src/domain/index.ts: core package source must not reference demo-owned artifacts.',
    'packages/runtime/src/example.ts: core package source must not reference demo-owned artifacts.',
    'packages/runtime/src/index.ts: core package source must not reference demo-owned artifacts.',
    'packages/runtime/src/index.ts: packages/apps must not import examples (../../../examples/orders-demo/meta-registry).'
  ]);
});

test('rejects legacy BFF application directories and unsupported top-level dirs', () => {
  const workspace = createWorkspace({
    'packages/bff/src/application/services/.gitkeep': '',
    'packages/bff/src/core/.gitkeep': '',
    'packages/bff/src/domain/.gitkeep': '',
    'packages/bff/src/interface/.gitkeep': '',
    'packages/bff/src/mapper/.gitkeep': '',
    'packages/bff/src/services/.gitkeep': '',
    'packages/bff/src/types/.gitkeep': '',
    'packages/bff/src/infra/repository/.gitkeep': '',
    'packages/bff/src/infra/interfaces/.gitkeep': '',
    'packages/bff/src/gateway/query.controller.ts': 'export class QueryController {}\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/application: forbidden BFF source directory.',
    'packages/bff/src/core: forbidden BFF source directory.',
    'packages/bff/src/domain: forbidden BFF source directory.',
    'packages/bff/src/interface: forbidden BFF source directory.',
    'packages/bff/src/mapper: forbidden BFF source directory.',
    'packages/bff/src/infra/interfaces: forbidden BFF source directory.',
    'packages/bff/src/infra/repository: forbidden BFF source directory.',
    'packages/bff/src/services: forbidden BFF source directory.',
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

test('allows BFF local controller and infra contracts while rejecting forbidden gateway layers', () => {
  const allowed = createWorkspace({
    'packages/bff/src/controller/http/view.gateway.interface.ts': 'export interface ViewRequestLike {}\n',
    'packages/bff/src/controller/http/view.request.type.ts': 'export type ViewApiRequest = {};\n',
    'packages/bff/src/infra/cache/cache-entry.type.ts': 'export type CacheHit<T> = { value: T };\n',
    'packages/bff/src/infra/integration/meta-registry-client.interface.ts': 'export interface MetaRegistryProvider {}\n'
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/bff/src/interface/view.interface.ts': 'export interface ViewRequestLike {}\n',
    'packages/bff/src/types/view.type.ts': 'export type ViewApiRequest = {};\n',
    'packages/bff/src/services/view.service.ts': 'export class ViewService {}\n',
    'packages/bff/src/controller/http/view.service.ts': 'export class ViewService {}\n'
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/bff/src/interface: forbidden BFF source directory.',
    'packages/bff/src/services: forbidden BFF source directory.',
    'packages/bff/src/types: forbidden BFF source directory.',
    'packages/bff/src/controller/http/view.service.ts: BFF controller service files must live under infra-owned gateway services.'
  ]);
});

test('enforces common package core/domain/application boundaries', () => {
  const allowed = createWorkspace({
    'packages/kernel/src/core/interfaces/meta-kernel.interface.ts': 'export interface MetaKernelRepositoryPort {}\n',
    'packages/kernel/src/application/services/meta-kernel.service.ts': 'export class MetaKernelService {}\n',
    'packages/query/src/core/types/index.ts': 'export {};\n',
    'packages/bff/src/infra/cache/cache.service.ts': 'export class CacheService {}\n'
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/audit/src/application/audit.service.ts': 'export class AuditService {}\n',
    'packages/kernel/src/index.ts': 'export * from "./core";\nexport * from "./infra";\n',
    'packages/kernel/src/domain/schema-diff.ts': 'export interface SchemaDiff {}\n',
    'packages/kernel/src/core/types/bad.ts': 'import { x } from "../../domain/schema-diff";\n',
    'packages/runtime/src/application/executor/bad.ts': 'export type Bad = {};\n',
    'packages/query/src/domain/bad.ts': 'import { x } from "../infra/query.adapter";\nimport { y } from "@zhongmiao/meta-lc-runtime";\n',
    'packages/runtime/src/application/bad.adapter.ts': 'export const x = 1;\n',
    'packages/runtime/src/domain/runtime.service.ts': 'export class RuntimeService {}\n'
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/audit/src/application/audit.service.ts: service classes must live under src/application/services.',
    'packages/kernel/src/core/types/bad.ts: core files must not import domain/application/infra (../../domain/schema-diff).',
    'packages/kernel/src/domain/schema-diff.ts: implementation files must not export interface declarations.',
    'packages/kernel/src/index.ts: package root must not export infra.',
    'packages/kernel/src/index.ts: kernel root may only export-star ./application, ./core.',
    'packages/query/src/domain/bad.ts: domain files must not depend on @zhongmiao/meta-lc-runtime.',
    'packages/query/src/domain/bad.ts: domain files must not import infra (../infra/query.adapter).',
    'packages/query/src/domain/bad.ts: query cannot depend on @zhongmiao/meta-lc-runtime.',
    'packages/runtime/src/application/bad.adapter.ts: adapters and persistence implementations must live under src/infra.',
    'packages/runtime/src/application/executor/bad.ts: implementation files must not export type declarations.',
    'packages/runtime/src/domain/runtime.service.ts: service classes must live under src/application/services.'
  ]);
});

test('keeps BFF root public API narrow', () => {
  const allowed = createWorkspace({
    'packages/bff/src/index.ts': [
      'export { AppModule, createBffGatewayModule } from "./bootstrap/app.module";',
      'export { startBffServer } from "./bootstrap/main";'
    ].join('\n')
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/bff/src/index.ts': [
      'export { AppModule, createBffGatewayModule, InternalThing } from "./bootstrap/app.module";',
      'export type { RuntimeGatewayRunner } from "./controller/http/view.gateway.interface";',
      'export * from "./infra";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/bff/src/index.ts: BFF root must not export types.',
    'packages/bff/src/index.ts: BFF root must not use export-star barrels.',
    'packages/bff/src/index.ts: BFF root export "InternalThing" is not public API.'
  ]);
});

test('keeps kernel query and permission root public APIs narrow', () => {
  const allowed = createWorkspace({
    'packages/kernel/src/index.ts': [
      'export * from "./core";',
      'export * from "./application";'
    ].join('\n'),
    'packages/query/src/index.ts': [
      'export * from "./core";',
      'export { buildSelectQueryAst, compileSelectAst, compileSelectQuery } from "./domain/query-compiler";'
    ].join('\n'),
    'packages/permission/src/index.ts': [
      'export * from "./core";',
      'export { buildDataScopeFilter, buildRowLevelFilter, canAccessOrg, injectPermissionClause, resolveDataScope } from "./domain/permission-engine";',
      'export { transformSelectQueryAstWithPermission } from "./domain/permission-ast-transform";'
    ].join('\n')
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/kernel/src/index.ts': [
      'export * from "./core";',
      'export * from "./domain";',
      'export { validateSchema } from "./core/utils";'
    ].join('\n'),
    'packages/query/src/index.ts': [
      'export * from "./core";',
      'export * from "./utils";',
      'export { parseCondition } from "./domain/query-compiler";'
    ].join('\n'),
    'packages/permission/src/index.ts': [
      'export * from "./core";',
      'export * from "./domain";',
      'export { buildPermissionAst } from "./domain/permission-ast-transform";'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/kernel/src/index.ts: kernel root may only export-star ./application, ./core.',
    'packages/kernel/src/index.ts: kernel root export "validateSchema" is not public API.',
    'packages/permission/src/index.ts: permission root may only export-star ./core.',
    'packages/permission/src/index.ts: permission root export "buildPermissionAst" is not public API.',
    'packages/query/src/index.ts: query root may only export-star ./core.',
    'packages/query/src/index.ts: query root export "parseCondition" is not public API.'
  ]);
});

test('enforces common package file semantic purity', () => {
  const allowed = createWorkspace({
    'packages/runtime/src/core/index.ts': 'export * from "./types";\nexport * from "./interfaces";\n',
    'packages/runtime/src/index.ts': [
      'export * from "./core";',
      'export * from "./application/facades";'
    ].join('\n'),
    'packages/runtime/src/core/interfaces/runtime.interface.ts': 'import type { RuntimeContext } from "../types";\nexport interface RuntimePort { run(context: RuntimeContext): void; }\n',
    'packages/runtime/src/core/types/runtime.type.ts': 'import type { RuntimePort } from "../interfaces";\nexport type RuntimeContext = Record<string, unknown>;\nexport type RuntimePortLike = RuntimePort;\n',
    'packages/runtime/src/domain/audit.entity.ts': 'export class AuditEntity {}\n'
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const rejected = createWorkspace({
    'packages/audit/src/domain/audit.entity.ts': 'export interface AuditRecord {}\nexport type AuditStatus = "success";\nexport class AuditEntity {}\n',
    'packages/kernel/src/core/interfaces/bad.interface.ts': 'import { value } from "../utils";\nexport type Bad = {};\nexport const bad = value;\n',
    'packages/query/src/core/types/bad.type.ts': 'import { value } from "../utils";\nexport interface Bad {}\nexport function makeBad() {}\n',
    'packages/permission/src/core/types/shared.types.ts': 'export type Bad = {};\n',
    'packages/kernel/src/core/types/migration-safety.types.ts': 'export interface MigrationGuardOptions {}\n',
    'packages/runtime/src/index.ts': [
      'export * from "./core";',
      'export * from "./application";',
      'export { RuntimeExecutor } from "./application/executor/runtime-executor";'
    ].join('\n'),
    'packages/runtime/src/domain/graph/bad.ts': 'import { x } from "../../core";\n',
    'packages/runtime/src/core/types/bad.ts': 'export const bad = true;\n',
    'packages/datasource/src/core/interfaces/bad.ts': 'export type Bad = {};\nexport class Bad {}\n'
  });

  assert.deepEqual(checkWorkspace(rejected), [
    'packages/audit/src/domain/audit.entity.ts: *.entity.ts files may not export interface declarations.',
    'packages/audit/src/domain/audit.entity.ts: *.entity.ts files may not export type declarations.',
    'packages/datasource/src/core/interfaces/bad.ts: core interfaces files may not export type declarations.',
    'packages/datasource/src/core/interfaces/bad.ts: core interfaces files may not export runtime values.',
    'packages/kernel/src/core/interfaces/bad.interface.ts: *.interface.ts files may only use import type declarations.',
    'packages/kernel/src/core/interfaces/bad.interface.ts: *.interface.ts files may not export type declarations.',
    'packages/kernel/src/core/interfaces/bad.interface.ts: *.interface.ts files may only export interface declarations.',
    'packages/kernel/src/core/interfaces/bad.interface.ts: core interfaces files may not export type declarations.',
    'packages/kernel/src/core/interfaces/bad.interface.ts: core interfaces files may not export runtime values.',
    'packages/kernel/src/core/types/migration-safety.types.ts: shared *.types.ts bucket files are forbidden; use *.type.ts or *.interface.ts.',
    'packages/kernel/src/core/types/migration-safety.types.ts: core types files may not export interface declarations.',
    'packages/permission/src/core/types/shared.types.ts: shared *.types.ts bucket files are forbidden; use *.type.ts or *.interface.ts.',
    'packages/query/src/core/types/bad.type.ts: *.type.ts files may only use import type declarations.',
    'packages/query/src/core/types/bad.type.ts: *.type.ts files may not export interface declarations.',
    'packages/query/src/core/types/bad.type.ts: *.type.ts files may only export type declarations.',
    'packages/query/src/core/types/bad.type.ts: core types files may not export runtime values.',
    'packages/query/src/core/types/bad.type.ts: core types files may not export interface declarations.',
    'packages/runtime/src/core/types/bad.ts: core types files may not export runtime values.',
    'packages/runtime/src/domain/graph/bad.ts: package-internal source must not import the core root barrel (../../core).',
    'packages/runtime/src/index.ts: runtime root may only export-star ./application/facades, ./core.',
    'packages/runtime/src/index.ts: runtime root export "RuntimeExecutor" is not public API.'
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
    'packages/bff/src/controller/http/bad.service.ts: BFF controller service files must live under infra-owned gateway services.',
    'packages/bff/src/controller/http/bad.service.ts: BFF must call runtime facade instead of importing compileViewDefinition.',
    'packages/bff/src/controller/http/bad.service.ts: BFF must call runtime facade instead of importing executeQueryNode.',
    'packages/bff/src/controller/http/query.controller.ts: legacy /query and /mutation endpoints are forbidden.'
  ]);
});

test('rejects misplaced structure and execution contract definitions', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/core/types/shared.types.ts': [
      'export interface ViewDefinition {}',
      'export type ExecutionPlan = {}'
    ].join('\n'),
    'packages/kernel/src/core/types/shared.types.ts': [
      'export interface ViewDefinition {}',
      'export type ExecutionPlan = {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/core/types/shared.types.ts: shared *.types.ts bucket files are forbidden; use *.type.ts or *.interface.ts.',
    'packages/kernel/src/core/types/shared.types.ts: core types files may not export interface declarations.',
    'packages/kernel/src/core/types/shared.types.ts: execution contract "ExecutionPlan" must be defined in packages/runtime only.',
    'packages/runtime/src/core/types/shared.types.ts: shared *.types.ts bucket files are forbidden; use *.type.ts or *.interface.ts.',
    'packages/runtime/src/core/types/shared.types.ts: core types files may not export interface declarations.',
    'packages/runtime/src/core/types/shared.types.ts: structure contract "ViewDefinition" must be defined in packages/kernel only.'
  ]);
});

test('rejects misplaced query AST contracts and runtime datasource implementation imports', () => {
  const workspace = createWorkspace({
    'packages/runtime/src/application/facades/bad.ts': [
      'import { createPostgresDatasourceAdapter, type DbConfig } from "@zhongmiao/meta-lc-datasource";',
      'export const bad = createPostgresDatasourceAdapter;'
    ].join('\n'),
    'packages/permission/src/core/interfaces/bad.interface.ts': 'export interface SelectQueryAst {}\n',
    'packages/kernel/src/core/types/bad.type.ts': 'export type QueryPredicate = {};\n'
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/kernel/src/core/types/bad.type.ts: query AST contract "QueryPredicate" must be defined in packages/query only.',
    'packages/permission/src/core/interfaces/bad.interface.ts: query AST contract "SelectQueryAst" must be defined in packages/query only.',
    'packages/runtime/src/application/facades/bad.ts: runtime may only import datasource contracts with import type.',
    'packages/runtime/src/application/facades/bad.ts: runtime must not import datasource implementation "createPostgresDatasourceAdapter".'
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
    'packages/bff/src/controller/http/bad.service.ts: BFF controller service files must live under infra-owned gateway services.',
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
        '@zhongmiao/meta-lc-kernel': 'workspace:*',
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
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-kernel" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-permission" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-query" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-audit" is forbidden in dependencies.',
    'packages/bff/package.json: BFF dependency "pg" is forbidden in dependencies.',
    'packages/bff/package.json: pg is forbidden in dependencies outside audit/datasource/kernel-adapter-postgres packages.',
    'packages/bff/package.json: BFF dependency "@types/pg" is forbidden in devDependencies.',
    'packages/bff/package.json: @types/pg is forbidden in devDependencies outside audit/datasource/kernel-adapter-postgres packages.',
    'packages/bff/src/controller/http/bad.ts: direct pg import is forbidden outside audit/datasource/kernel-adapter-postgres packages.',
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

test('keeps BFF meta registry provider-only without workspace imports', () => {
  const workspace = createWorkspace({
    'packages/bff/src/infra/integration/meta-registry.service.ts': [
      'import { MetaKernelService } from "@zhongmiao/meta-lc-kernel";',
      'export class MetaRegistryService {}'
    ].join('\n')
  });

  assert.deepEqual(checkWorkspace(workspace), [
    'packages/bff/src/infra/integration/meta-registry.service.ts: BFF meta registry gateway must use injected providers and must not import workspace packages.',
    'packages/bff/src/infra/integration/meta-registry.service.ts: BFF cannot depend on @zhongmiao/meta-lc-kernel.'
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
    'apps/bff-server/src/main.ts: bff-server app can only depend on approved composition packages.'
  ]);
});

test('keeps kernel-adapter-postgres composition-only for packages while allowing apps', () => {
  const allowed = createWorkspace({
    'apps/bff-server/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-bff': 'workspace:*',
        '@zhongmiao/meta-lc-datasource': 'workspace:*',
        '@zhongmiao/meta-lc-audit': 'workspace:*',
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      }
    }),
    'apps/bff-server/src/main.ts': [
      'import { startBffServer } from "@zhongmiao/meta-lc-bff";',
      'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";'
    ].join('\n')
  });
  assert.deepEqual(checkWorkspace(allowed), []);

  const workspace = createWorkspace({
    'packages/kernel/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      }
    }),
    'packages/kernel/src/bad.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n',
    'packages/runtime/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      }
    }),
    'packages/runtime/src/bad.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n',
    'packages/bff/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      }
    }),
    'packages/bff/src/controller/http/bad.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n',
    'packages/query/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      }
    }),
    'packages/query/src/domain/bad.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n',
    'packages/permission/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      }
    }),
    'packages/permission/src/domain/bad.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n',
    'packages/datasource/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      },
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } }
    }),
    'packages/datasource/src/infra/adapters/bad.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n',
    'packages/audit/package.json': packageJson({
      dependencies: {
        '@zhongmiao/meta-lc-kernel-adapter-postgres': 'workspace:*'
      },
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } }
    }),
    'packages/audit/src/application/services/bad.service.ts': 'import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";\n'
  });

  assert.deepEqual(checkWorkspace(workspace).sort(), [
    'packages/audit/package.json: audit dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/audit/src/application/services/bad.service.ts: audit cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.',
    'packages/bff/package.json: BFF dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/bff/src/controller/http/bad.ts: BFF cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.',
    'packages/datasource/package.json: datasource dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/datasource/src/infra/adapters/bad.ts: datasource cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.',
    'packages/kernel/package.json: kernel dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/kernel/src/bad.ts: kernel cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.',
    'packages/permission/package.json: permission dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/permission/src/domain/bad.ts: permission cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.',
    'packages/query/package.json: query dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/query/src/domain/bad.ts: query cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.',
    'packages/runtime/package.json: runtime dependency "@zhongmiao/meta-lc-kernel-adapter-postgres" is forbidden in dependencies.',
    'packages/runtime/src/bad.ts: runtime cannot depend on @zhongmiao/meta-lc-kernel-adapter-postgres.'
  ].sort());
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
      },
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } }
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
      },
      peerDependencies: { pg: '^8.13.1' },
      peerDependenciesMeta: { pg: { optional: true } }
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
