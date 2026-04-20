import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPageTopic,
  RuntimeWsGateway,
  type PageSubscribedEvent,
  type WsClientLike
} from "../src/gateway/ws.gateway";

test("buildPageTopic creates tenant/page/instance scoped topic", () => {
  assert.equal(
    buildPageTopic({
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1"
    }),
    "tenant.tenant-a.page.orders.instance.instance-1"
  );
});

test("runtime websocket gateway confirms page subscription", () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };

  gateway.handleConnection(client);
  const result = gateway.subscribePage(
    {
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1"
    },
    client
  );
  gateway.handleDisconnect(client);

  const expected: PageSubscribedEvent = {
    tenantId: "tenant-a",
    pageId: "orders",
    pageInstanceId: "instance-1",
    topic: "tenant.tenant-a.page.orders.instance.instance-1",
    status: "subscribed"
  };
  assert.deepEqual(result, expected);
  assert.deepEqual(emitted, [{ event: "pageSubscribed", payload: expected }]);
});
