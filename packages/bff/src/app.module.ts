import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuditLogService } from "./common/audit-log.service";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { QueryController } from "./gateway/query.controller";
import { AuditPersistenceService } from "./integration/audit-persistence.service";
import { OrgScopeService } from "./integration/org-scope.service";
import { PostgresQueryExecutorService } from "./integration/postgres-query-executor.service";
import { MutationOrchestratorService } from "./orchestration/mutation-orchestrator.service";
import { QueryOrchestratorService } from "./orchestration/query-orchestrator.service";

@Module({
  imports: [],
  controllers: [QueryController],
  providers: [
    PostgresQueryExecutorService,
    OrgScopeService,
    AuditPersistenceService,
    QueryOrchestratorService,
    MutationOrchestratorService,
    AuditLogService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ]
})
export class AppModule {}
