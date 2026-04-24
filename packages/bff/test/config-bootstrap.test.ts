import { test } from "node:test";
import assert from "node:assert/strict";
import { isProductionEnv, loadBootstrapMode, shouldAutoBootstrap } from "../src/types/config";

const originalEnv = { ...process.env };

function resetEnv(): void {
  process.env = { ...originalEnv };
}

test("loadBootstrapMode defaults to manual", () => {
  resetEnv();
  delete process.env.LC_DB_BOOTSTRAP_MODE;
  assert.equal(loadBootstrapMode(), "manual");
});

test("shouldAutoBootstrap true only in non-production auto mode", () => {
  resetEnv();
  process.env.NODE_ENV = "development";
  process.env.LC_DB_BOOTSTRAP_MODE = "auto";
  assert.equal(shouldAutoBootstrap(), true);

  process.env.NODE_ENV = "production";
  assert.equal(isProductionEnv(), true);
  assert.equal(shouldAutoBootstrap(), false);
});
