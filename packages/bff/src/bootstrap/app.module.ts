import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { CacheService } from "../infra/cache/cache.service";
import { HttpExceptionFilter } from "../common/http-exception.filter";
import { MetaController } from "../controller/http/meta.controller";
import { ViewController } from "../controller/http/view.controller";
import {
  createRuntimeWsBroadcastBusFromEnv,
  parseRuntimeWsBroadcastBusMode,
} from "../controller/ws/runtime/broadcast.bus";
import {
  RUNTIME_WS_BROADCAST_BUS,
  RUNTIME_WS_INSTANCE_ID,
  RUNTIME_WS_REPLAY_STORE
} from "../constants/runtime-ws.constants";
import { HealthController } from "../controller/http/health.controller";
import { RuntimeWsHealthController } from "../controller/ws/runtime/health.controller";
import { RuntimeWsOperationsState } from "../controller/ws/runtime/operations.state";
import {
  createRuntimeWsReplayStoreFromEnv,
  parseRuntimeWsReplayStoreMode
} from "../controller/ws/runtime/replay.store";
import { RuntimeWsGateway } from "../controller/ws/runtime/ws.gateway";
import { AuditPersistenceService } from "../infra/integration/audit.service";
import { MetaRegistryService } from "../infra/integration/meta-registry.service";
import { OrgScopeService } from "../infra/integration/org-scope.service";
import { PostgresQueryExecutorService } from "../infra/integration/postgres-query.service";
import { RuntimeAuditObserverService } from "../infra/integration/runtime-audit-observer.service";
import { RuntimeViewDependenciesService } from "../infra/integration/runtime-view-dependencies.service";

@Module({
  imports: [],
  controllers: [HealthController, ViewController, MetaController, RuntimeWsHealthController],
  providers: [
    CacheService,
    MetaRegistryService,
    PostgresQueryExecutorService,
    RuntimeAuditObserverService,
    RuntimeViewDependenciesService,
    OrgScopeService,
    AuditPersistenceService,
    {
      provide: RUNTIME_WS_INSTANCE_ID,
      useFactory: () => randomUUID()
    },
    {
      provide: RuntimeWsOperationsState,
      useFactory: (instanceId: string) =>
        new RuntimeWsOperationsState({
          replayStoreMode: parseRuntimeWsReplayStoreMode(process.env.LC_RUNTIME_WS_REPLAY_STORE),
          broadcastBusMode: parseRuntimeWsBroadcastBusMode(process.env.LC_RUNTIME_WS_BROADCAST_BUS),
          instanceId
        }),
      inject: [RUNTIME_WS_INSTANCE_ID]
    },
    {
      provide: RUNTIME_WS_REPLAY_STORE,
      useFactory: () => createRuntimeWsReplayStoreFromEnv()
    },
    {
      provide: RUNTIME_WS_BROADCAST_BUS,
      useFactory: () => createRuntimeWsBroadcastBusFromEnv()
    },
    RuntimeWsGateway,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ]
})
export class AppModule {}
