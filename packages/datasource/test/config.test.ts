import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDbConfig } from "../src/postgres/config";

test("loadDbConfig reads env values", () => {
  process.env.LC_DB_HOST = "127.0.0.1";
  process.env.LC_DB_PORT = "15432";
  process.env.LC_DB_USER = "dev_user";
  process.env.LC_DB_PASSWORD = "dev_pass";
  process.env.LC_DB_NAME = "dev_db";
  process.env.LC_DB_SSL = "true";

  const config = loadDbConfig();
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 15432);
  assert.equal(config.user, "dev_user");
  assert.equal(config.password, "dev_pass");
  assert.equal(config.database, "dev_db");
  assert.equal(config.ssl, true);
});

test("loadDbConfig throws when required env is missing", () => {
  delete process.env.LC_DB_HOST;
  delete process.env.LC_DB_USER;
  delete process.env.LC_DB_PASSWORD;
  delete process.env.LC_DB_NAME;

  assert.throws(() => loadDbConfig(), /Missing required env/);
});
