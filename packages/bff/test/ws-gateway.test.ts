import assert from "node:assert/strict";
import test from "node:test";
import {
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type RuntimeManagerExecutedEvent
} from "@zhongmiao/meta-lc-contracts";
import {
  InMemoryRuntimeWsReplayStore,
  parseRuntimeWsReplayStoreMode,
  RedisRuntimeWsReplayStore,
  type RedisRuntimeWsReplayClient,
  type RuntimeWsReplayStore
} from "../src/gateway/runtime-ws-replay.store";
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

class RecordingReplayStore implements RuntimeWsReplayStore {
  readonly saved: RuntimeManagerExecutedEvent[] = [];
  private readonly latest = new Map<string, RuntimeManagerExecutedEvent>();

  constructor(initialEvents: RuntimeManagerExecutedEvent[] = []) {
    for (const event of initialEvents) {
      this.latest.set(event.topic, event);
    }
  }

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<void> {
    this.saved.push(event);
    this.latest.set(event.topic, event);
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    return this.latest.get(topic);
  }
}

class FakeRedisClient implements RedisRuntimeWsReplayClient {
  readonly values = new Map<string, string>();
  readonly setCalls: Array<{ key: string; value: string }> = [];
  connected = false;

  constructor(private readonly failWith?: Error) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async get(key: string): Promise<string | null> {
    if (this.failWith) {
      throw this.failWith;
    }
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.setCalls.push({ key, value });
    this.values.set(key, value);
  }
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

test("runtime websocket gateway confirms page subscription", async () => {
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
  const result = await gateway.subscribePage(
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

test("runtime websocket gateway confirms page subscription when join is unavailable", async () => {
  const gateway = new RuntimeWsGateway();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };

  const result = await gateway.subscribePage(
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

test("runtime websocket gateway broadcasts manager executed updates to topic rooms", async () => {
  const replayStore = new RecordingReplayStore();
  const gateway = new RuntimeWsGateway(replayStore);
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

  const result = await gateway.broadcastRuntimeManagerExecuted(update);

  assert.deepEqual(result, update);
  assert.deepEqual(replayStore.saved, [update]);
  assert.deepEqual(emitted, [
    {
      room: "tenant.tenant-a.page.orders.instance.instance-1",
      event: RUNTIME_MANAGER_EXECUTED_EVENT,
      payload: update
    }
  ]);
});

test("runtime websocket gateway replays the latest topic update on subscription", async () => {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };
  const update = createUpdate();
  const gateway = new RuntimeWsGateway(new RecordingReplayStore([update]));

  await gateway.subscribePage(
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

test("runtime websocket gateway does not replay updates for other topics", async () => {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };
  const gateway = new RuntimeWsGateway(
    new RecordingReplayStore([createUpdate("tenant.tenant-a.page.customers.instance.instance-1")])
  );

  await gateway.subscribePage(
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

test("in-memory runtime websocket replay store saves and returns latest topic event", async () => {
  const store = new InMemoryRuntimeWsReplayStore();
  const first = createUpdate();
  const latest = createUpdate("tenant.tenant-a.page.orders.instance.instance-1");
  const otherTopic = createUpdate("tenant.tenant-a.page.customers.instance.instance-1");

  await store.saveLatest(first);
  await store.saveLatest(otherTopic);
  await store.saveLatest(latest);

  assert.deepEqual(await store.getLatest("tenant.tenant-a.page.orders.instance.instance-1"), latest);
  assert.deepEqual(await store.getLatest("tenant.tenant-a.page.customers.instance.instance-1"), otherTopic);
  assert.equal(await store.getLatest("tenant.tenant-a.page.missing.instance.instance-1"), undefined);
});

test("redis runtime websocket replay store serializes and returns latest topic event", async () => {
  const client = new FakeRedisClient();
  const store = new RedisRuntimeWsReplayStore(client, { keyPrefix: "test:runtime" });
  const update = createUpdate();

  await store.connect();
  await store.saveLatest(update);

  assert.equal(client.connected, true);
  assert.deepEqual(client.setCalls, [
    {
      key: "test:runtime:tenant.tenant-a.page.orders.instance.instance-1",
      value: JSON.stringify(update)
    }
  ]);
  assert.deepEqual(await store.getLatest(update.topic), update);
  assert.equal(await store.getLatest("tenant.tenant-a.page.missing.instance.instance-1"), undefined);
});

test("redis runtime websocket replay store fails on invalid payload", async () => {
  const client = new FakeRedisClient();
  client.values.set("test:runtime:tenant.tenant-a.page.orders.instance.instance-1", JSON.stringify({ topic: "oops" }));
  const store = new RedisRuntimeWsReplayStore(client, { keyPrefix: "test:runtime" });

  await assert.rejects(
    () => store.getLatest("tenant.tenant-a.page.orders.instance.instance-1"),
    /Invalid runtime manager executed replay payload/
  );
});

test("redis runtime websocket replay store propagates client errors", async () => {
  const store = new RedisRuntimeWsReplayStore(new FakeRedisClient(new Error("redis down")));

  await assert.rejects(() => store.saveLatest(createUpdate()), /redis down/);
  await assert.rejects(() => store.getLatest("tenant.tenant-a.page.orders.instance.instance-1"), /redis down/);
});

test("runtime websocket replay store mode defaults to memory and rejects unknown modes", () => {
  assert.equal(parseRuntimeWsReplayStoreMode(undefined), "memory");
  assert.equal(parseRuntimeWsReplayStoreMode(""), "memory");
  assert.equal(parseRuntimeWsReplayStoreMode("memory"), "memory");
  assert.equal(parseRuntimeWsReplayStoreMode("redis"), "redis");
  assert.throws(() => parseRuntimeWsReplayStoreMode("postgres"), /Invalid LC_RUNTIME_WS_REPLAY_STORE/);
});
