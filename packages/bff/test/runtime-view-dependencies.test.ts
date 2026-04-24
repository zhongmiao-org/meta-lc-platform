import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeViewDependenciesService } from "../src/infra/integration/runtime-view-dependencies.service";

test("runtime view dependencies inject runtime audit observer", () => {
  const auditObserver = {
    recordRuntimeEvent() {}
  };
  const service = new RuntimeViewDependenciesService({} as never, auditObserver as never);

  const deps = service.create();

  assert.equal(deps.auditObserver, auditObserver);
});
