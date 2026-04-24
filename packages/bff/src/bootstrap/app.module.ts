import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AggregationService } from "../application/orchestrator/aggregation.orchestrator";
import { MetaQueryService } from "../application/services/meta-query.service";
import { MetaRegistryService } from "../application/services/meta-registry.service";
import { TemporaryViewAdapter } from "../application/services/temporary-view-adapter.service";
import { CacheService } from "../infra/cache/cache.service";
import { AuditLogService } from "../application/services/audit-log.service";
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
import { RuntimeWsHealthController } from "../controller/ws/runtime/health.controller";
import { RuntimeWsOperationsState } from "../controller/ws/runtime/operations.state";
import {
  createRuntimeWsReplayStoreFromEnv,
  parseRuntimeWsReplayStoreMode
} from "../controller/ws/runtime/replay.store";
import { QueryController } from "../controller/http/query.controller";
import { RuntimeWsGateway } from "../controller/ws/runtime/ws.gateway";
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
    MetaQueryService,
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
