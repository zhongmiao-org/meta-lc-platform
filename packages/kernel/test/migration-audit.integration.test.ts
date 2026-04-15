import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { MetaKernelService } from "../src/meta-kernel-service";
import { PostgresMetaKernelRepository } from "../src/postgres-meta-kernel-repository";

const runIntegration = process.env.RUN_DB_INTEGRATION === "true";

test(
  "integration: migration writes success/failure/blocked audits",
  { skip: !runIntegration },
  async () => {
    const config = {
      host: readRequired("LC_DB_HOST"),
      port: Number(process.env.LC_DB_PORT ?? "5432"),
      user: readRequired("LC_DB_USER"),
      password: readRequired("LC_DB_PASSWORD"),
      database: readRequired("LC_DB_NAME"),
      ssl: (process.env.LC_DB_SSL ?? "false").toLowerCase() === "true"
    };
    const repository = new PostgresMetaKernelRepository(config);
    const service = new MetaKernelService(repository);

    await repository.init();
    const appId = `app_${Date.now()}`;
    const tableName = `orders_${Date.now()}`;
    const requestIdSuccess = randomUUID();
    const requestIdFailure = randomUUID();
    const requestIdBlocked = randomUUID();

    try {
      await service.publishSchema({
        appId,
        schema: {
          tables: [{ name: tableName, fields: [{ name: "id", type: "uuid" }] }]
        },
        author: "integration",
        message: "v1"
      });
      await service.publishSchema({
        appId,
        schema: {
          tables: [
            {
              name: tableName,
              fields: [
                { name: "id", type: "uuid" },
                { name: "status", type: "string" }
              ]
            }
          ]
        },
        author: "integration",
        message: "v2"
      });

      const successResult = await service.migrateToVersion(appId, 1, 2, {
        requestId: requestIdSuccess
      });
      assert.equal(successResult.applied, true);
      assert.ok(successResult.auditCount >= 1);

      const successAudits = await repository.listMigrationAudits(requestIdSuccess);
      assert.ok(successAudits.some((item) => item.status === "success"));

      await assert.rejects(
        repository.executeMigration(
          [`ALTER TABLE "__missing_table_${Date.now()}__" ADD COLUMN "x" INTEGER;`],
          {},
          {
            appId,
            fromVersion: 2,
            toVersion: 3,
            requestId: requestIdFailure
          }
        )
      );
      const failureAudits = await repository.listMigrationAudits(requestIdFailure);
      assert.ok(failureAudits.some((item) => item.status === "failure"));

      await assert.rejects(
        service.migrateToVersion(appId, 2, 1, {
          requestId: requestIdBlocked
        }),
        /Blocked destructive migration statements/
      );
      const blockedAudits = await repository.listMigrationAudits(requestIdBlocked);
      assert.ok(blockedAudits.some((item) => item.status === "blocked"));
    } finally {
      await repository.close();
    }
  }
);

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}
