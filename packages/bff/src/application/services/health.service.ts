import { Injectable } from "@nestjs/common";
import { PostgresQueryExecutorService } from "../../infra/integration/postgres-query.service";

@Injectable()
export class HealthService {
  constructor(private readonly queryExecutor: PostgresQueryExecutorService) {}

  async check(): Promise<{ ok: boolean }> {
    return {
      ok: await this.queryExecutor.health()
    };
  }
}
