import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "../src/controller/http/health.controller";

test("health controller returns the gateway health result without legacy orchestrators", async () => {
  const controller = new HealthController({
    async check() {
      return { ok: true };
    }
  } as never);

  assert.deepEqual(await controller.health(), { ok: true });
});
