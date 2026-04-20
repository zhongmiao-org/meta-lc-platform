import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AggregationService } from "./aggregation/aggregation.service";
import { CacheService } from "./cache/cache.service";
import { AuditLogService } from "./common/audit-log.service";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { MetaController } from "./gateway/meta.controller";
import { MetaRegistryService } from "./gateway/meta-registry.service";
import {
  createRuntimeWsBroadcastBusFromEnv,
  parseRuntimeWsBroadcastBusMode,
  RUNTIME_WS_BROADCAST_BUS,
  RUNTIME_WS_INSTANCE_ID
} from "./gateway/runtime-ws-broadcast.bus";
import { RuntimeWsHealthController } from "./gateway/runtime-ws-health.controller";
import { RuntimeWsOperationsState } from "./gateway/runtime-ws-operations.state";
import {
  createRuntimeWsReplayStoreFromEnv,
  parseRuntimeWsReplayStoreMode,
  RUNTIME_WS_REPLAY_STORE
} from "./gateway/runtime-ws-replay.store";
import { QueryController } from "./gateway/query.controller";
import { RuntimeWsGateway } from "./gateway/ws.gateway";
import { AuditPersistenceService } from "./integration/audit-persistence.service";
import { OrgScopeService } from "./integration/org-scope.service";
import { PostgresQueryExecutorService } from "./integration/postgres-query-executor.service";
import { MutationOrchestratorService } from "./orchestration/mutation-orchestrator.service";
import { QueryOrchestratorService } from "./orchestration/query-orchestrator.service";

@Module({
  imports: [],
  controllers: [QueryController, MetaController, RuntimeWsHealthController],
  providers: [
    AggregationService,
    CacheService,
    MetaRegistryService,
    PostgresQueryExecutorService,
    OrgScopeService,
    AuditPersistenceService,
    QueryOrchestratorService,
    MutationOrchestratorService,
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
