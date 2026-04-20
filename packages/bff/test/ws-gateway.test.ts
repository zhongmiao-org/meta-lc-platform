import assert from "node:assert/strict";
import test from "node:test";
import {
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type RuntimeManagerExecutedEvent
} from "@zhongmiao/meta-lc-contracts";
import {
  buildPageTopic,
  RuntimeWsGateway,
  type PageSubscribedEvent,
  type WsClientLike,
  type WsServerLike
} from "../src/gateway/ws.gateway";

function createUpdate(topic = "tenant.tenant-a.page.orders.instance.instance-1"): RuntimeManagerExecutedEvent {
  return {
    type: "runtime.manager.executed",
    topic,
    page: {
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1"
    },
    requestId: "req-1",
    patchState: { shouldReload: true },
    refreshedDatasourceIds: ["orders"],
    runActionIds: ["notify"]
  };
}

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
  const joinedRooms: string[] = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    },
    join(room: string): void {
      joinedRooms.push(room);
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
  assert.deepEqual(joinedRooms, ["tenant.tenant-a.page.orders.instance.instance-1"]);
  assert.deepEqual(emitted, [{ event: "pageSubscribed", payload: expected }]);
});

test("runtime websocket gateway confirms page subscription when join is unavailable", () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };

  const result = gateway.subscribePage(
    {
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1"
    },
    client
  );

  assert.equal(result.topic, "tenant.tenant-a.page.orders.instance.instance-1");
  assert.deepEqual(emitted, [
    {
      event: "pageSubscribed",
      payload: {
        tenantId: "tenant-a",
        pageId: "orders",
        pageInstanceId: "instance-1",
        topic: "tenant.tenant-a.page.orders.instance.instance-1",
        status: "subscribed"
      }
    }
  ]);
});

test("runtime websocket gateway emits manager executed updates", () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };
  const update = createUpdate();

  const result = gateway.emitRuntimeManagerExecuted(client, update);

  assert.deepEqual(result, update);
  assert.deepEqual(emitted, [{ event: RUNTIME_MANAGER_EXECUTED_EVENT, payload: update }]);
});

test("runtime websocket gateway broadcasts manager executed updates to topic rooms", () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const server: WsServerLike = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown): void {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
  gateway.server = server;
  const update = createUpdate();

  const result = gateway.broadcastRuntimeManagerExecuted(update);

  assert.deepEqual(result, update);
  assert.deepEqual(emitted, [
    {
      room: "tenant.tenant-a.page.orders.instance.instance-1",
      event: RUNTIME_MANAGER_EXECUTED_EVENT,
      payload: update
    }
  ]);
});

test("runtime websocket gateway replays the latest topic update on subscription", () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };
  const update = createUpdate();
  gateway.broadcastRuntimeManagerExecuted(update);

  gateway.subscribePage(
    {
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1"
    },
    client
  );

  assert.deepEqual(emitted, [
    {
      event: "pageSubscribed",
      payload: {
        tenantId: "tenant-a",
        pageId: "orders",
        pageInstanceId: "instance-1",
        topic: "tenant.tenant-a.page.orders.instance.instance-1",
        status: "subscribed"
      }
    },
    { event: RUNTIME_MANAGER_EXECUTED_EVENT, payload: update }
  ]);
});

test("runtime websocket gateway does not replay updates for other topics", () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };
  gateway.broadcastRuntimeManagerExecuted(createUpdate("tenant.tenant-a.page.customers.instance.instance-1"));

  gateway.subscribePage(
    {
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1"
    },
    client
  );

  assert.deepEqual(emitted, [
    {
      event: "pageSubscribed",
      payload: {
        tenantId: "tenant-a",
        pageId: "orders",
        pageInstanceId: "instance-1",
        topic: "tenant.tenant-a.page.orders.instance.instance-1",
        status: "subscribed"
      }
    }
  ]);
});
