import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AggregationService } from "../application/orchestrator/aggregation.orchestrator";
import { MetaRegistryService } from "../application/services/meta-registry.service";
import { TemporaryViewAdapter } from "../application/view/temporary-view-adapter.service";
import { CacheService } from "../infra/cache/cache.service";
import { AuditLogService } from "../common/audit-log.service";
import { HttpExceptionFilter } from "../common/http-exception.filter";
import { MetaController } from "../interface/http/controller/meta.controller";
import { ViewController } from "../interface/http/controller/view.controller";
import {
  createRuntimeWsBroadcastBusFromEnv,
  parseRuntimeWsBroadcastBusMode,
  RUNTIME_WS_BROADCAST_BUS,
  RUNTIME_WS_INSTANCE_ID
} from "../interface/ws/runtime-ws-broadcast.bus";
import { RuntimeWsHealthController } from "../interface/ws/runtime-ws-health.controller";
import { RuntimeWsOperationsState } from "../interface/ws/runtime-ws-operations.state";
import {
  createRuntimeWsReplayStoreFromEnv,
  parseRuntimeWsReplayStoreMode,
  RUNTIME_WS_REPLAY_STORE
} from "../interface/ws/runtime-ws-replay.store";
import { QueryController } from "../interface/http/controller/query.controller";
import { RuntimeWsGateway } from "../interface/ws/ws.gateway";
import { AuditPersistenceService } from "../infra/integration/audit.service";
import { OrgScopeService } from "../infra/integration/org-scope.service";
import { PostgresQueryExecutorService } from "../infra/integration/postgres-query.service";
import { MutationOrchestratorService } from "../application/orchestrator/mutation.orchestrator";
import { QueryOrchestratorService } from "../application/orchestrator/query.orchestrator";

@Module({
  imports: [],
  controllers: [QueryController, ViewController, MetaController, RuntimeWsHealthController],
  providers: [
    AggregationService,
    CacheService,
    MetaRegistryService,
    PostgresQueryExecutorService,
    OrgScopeService,
    AuditPersistenceService,
    QueryOrchestratorService,
    MutationOrchestratorService,
    TemporaryViewAdapter,
    AuditLogService,
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
