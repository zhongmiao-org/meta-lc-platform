import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuditLogService } from "./common/audit-log.service";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { QueryController } from "./gateway/query.controller";
import { AuditPersistenceService } from "./integration/audit-persistence.service";
import { PostgresQueryExecutorService } from "./integration/postgres-query-executor.service";
import { QueryOrchestratorService } from "./orchestration/query-orchestrator.service";

@Module({
  imports: [],
  controllers: [QueryController],
  providers: [
    PostgresQueryExecutorService,
    AuditPersistenceService,
    QueryOrchestratorService,
    AuditLogService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ]
})
export class AppModule {}
