import assert from "node:assert/strict";
import test from "node:test";
import {
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type RuntimeManagerExecutedEvent
} from "@zhongmiao/meta-lc-runtime";
import {
  InProcessRuntimeWsBroadcastBus,
  parseRuntimeWsBroadcastBusMode,
  RedisRuntimeWsBroadcastBus
} from "../src/controller/ws/runtime/broadcast.bus";
import type {
  RedisRuntimeWsBroadcastClient,
  RuntimeWsBroadcastBus,
  RedisRuntimeWsStreamReplayClient,
  RedisRuntimeWsReplayClient,
  RuntimeWsReplayStore
} from "../src/controller/ws/runtime/runtime-ws.gateway.interface";
import type { WsClientLike, WsServerLike } from "../src/controller/ws/runtime/runtime-ws-client.type";
import type {
  PageSubscribedEvent,
  RedisRuntimeWsStreamEntry,
  RuntimeWsBroadcastHandler,
  RuntimeWsBroadcastPublishOptions
} from "../src/controller/ws/runtime/runtime-ws-event.type";
import { RuntimeWsHealthController } from "../src/controller/ws/runtime/health.controller";
import { RuntimeWsOperationsState } from "../src/controller/ws/runtime/operations.state";
import {
  InMemoryRuntimeWsReplayStore,
  parseRuntimeWsReplayLimit,
  parseRuntimeWsReplayStoreMode,
  RedisRuntimeWsReplayStore,
  RedisStreamRuntimeWsReplayStore
} from "../src/controller/ws/runtime/replay.store";
import {
  buildPageTopic,
  RuntimeWsGateway
} from "../src/controller/ws/runtime/ws.gateway";

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
  private readonly events: RuntimeManagerExecutedEvent[] = [];
  private readonly latest = new Map<string, RuntimeManagerExecutedEvent>();

  constructor(initialEvents: RuntimeManagerExecutedEvent[] = []) {
    for (const event of initialEvents) {
      this.events.push(event);
      this.latest.set(event.topic, event);
    }
  }

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    this.saved.push(event);
    this.events.push(event);
    this.latest.set(event.topic, event);
    return event;
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    return this.latest.get(topic);
  }

  async getAfter(topic: string, afterReplayId: string): Promise<RuntimeManagerExecutedEvent[]> {
    return this.events.filter(
      (event) => event.topic === topic && event.replayId && compareReplayId(event.replayId, afterReplayId) > 0
    );
  }
}

class ReplayIdReplayStore extends RecordingReplayStore {
  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    const savedEvent = { ...event, replayId: "2-0" };
    await super.saveLatest(savedEvent);
    return savedEvent;
  }
}

class FailingReplayStore implements RuntimeWsReplayStore {
  constructor(private readonly error: Error) {}

  async saveLatest(): Promise<RuntimeManagerExecutedEvent> {
    throw this.error;
  }

  async getLatest(): Promise<RuntimeManagerExecutedEvent | undefined> {
    throw this.error;
  }

  async getAfter(): Promise<RuntimeManagerExecutedEvent[]> {
    throw this.error;
  }
}

class RecordingBroadcastBus implements RuntimeWsBroadcastBus {
  readonly published: Array<{ event: RuntimeManagerExecutedEvent; options: RuntimeWsBroadcastPublishOptions }> = [];
  readonly handlers: RuntimeWsBroadcastHandler[] = [];
  closed = false;

  async publish(event: RuntimeManagerExecutedEvent, options: RuntimeWsBroadcastPublishOptions): Promise<void> {
    this.published.push({ event, options });
  }

  async subscribe(handler: RuntimeWsBroadcastHandler): Promise<void> {
    this.handlers.push(handler);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FailingBroadcastBus implements RuntimeWsBroadcastBus {
  constructor(private readonly error: Error) {}

  async publish(): Promise<void> {
    throw this.error;
  }

  async subscribe(): Promise<void> {}

  async close(): Promise<void> {}
}

class FakeRedisClient implements RedisRuntimeWsReplayClient, RedisRuntimeWsBroadcastClient, RedisRuntimeWsStreamReplayClient {
  readonly values = new Map<string, string>();
  readonly streams = new Map<string, RedisRuntimeWsStreamEntry[]>();
  readonly setCalls: Array<{ key: string; value: string }> = [];
  readonly xAddCalls: Array<{ key: string; id: string; message: Record<string, string> }> = [];
  readonly xRangeCalls: Array<{ key: string; start: string; end: string; options?: { COUNT?: number } }> = [];
  readonly xRevRangeCalls: Array<{ key: string; start: string; end: string; options?: { COUNT?: number } }> = [];
  readonly publishCalls: Array<{ channel: string; message: string }> = [];
  readonly subscriptions = new Map<string, (message: string, channel: string) => void | Promise<void>>();
  unsubscribedChannels: string[] = [];
  connected = false;
  quitCalled = false;

  constructor(private readonly failWith?: Error) {}

  duplicate(): FakeRedisClient {
    return this;
  }

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

  async xAdd(key: string, id: string, message: Record<string, string>): Promise<string> {
    if (this.failWith) {
      throw this.failWith;
    }
    const entries = this.streams.get(key) ?? [];
    const replayId = `${entries.length + 1}-0`;
    this.xAddCalls.push({ key, id, message });
    entries.push({ id: replayId, message });
    this.streams.set(key, entries);
    return replayId;
  }

  async xRange(
    key: string,
    start: string,
    end: string,
    options?: { COUNT?: number }
  ): Promise<RedisRuntimeWsStreamEntry[]> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.xRangeCalls.push({ key, start, end, options });
    const entries = this.streams.get(key) ?? [];
    const minId = start.startsWith("(") ? start.slice(1) : start;
    return entries.filter((entry) => compareReplayId(entry.id, minId) > 0).slice(0, options?.COUNT);
  }

  async xRevRange(
    key: string,
    start: string,
    end: string,
    options?: { COUNT?: number }
  ): Promise<RedisRuntimeWsStreamEntry[]> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.xRevRangeCalls.push({ key, start, end, options });
    return [...(this.streams.get(key) ?? [])].reverse().slice(0, options?.COUNT);
  }

  async publish(channel: string, message: string): Promise<void> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.publishCalls.push({ channel, message });
  }

  async subscribe(channel: string, listener: (message: string, channel: string) => void | Promise<void>): Promise<void> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.subscriptions.set(channel, listener);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.unsubscribedChannels.push(channel);
  }

  async quit(): Promise<void> {
    this.quitCalled = true;
  }
}

function compareReplayId(left: string, right: string): number {
  const [leftMs = "0", leftSeq = "0"] = left.split("-");
  const [rightMs = "0", rightSeq = "0"] = right.split("-");
  const leftParts = [Number(leftMs), Number(leftSeq)];
  const rightParts = [Number(rightMs), Number(rightSeq)];
  return leftParts[0] === rightParts[0] ? leftParts[1] - rightParts[1] : leftParts[0] - rightParts[0];
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

test("runtime websocket operations state tracks connected client count", () => {
  const operationsState = new RuntimeWsOperationsState({
    replayStoreMode: "memory",
    broadcastBusMode: "local",
    instanceId: "instance-a"
  });
  const gateway = new RuntimeWsGateway(
    new RecordingReplayStore(),
    new RecordingBroadcastBus(),
    "instance-a",
    operationsState
  );
  const client: WsClientLike = {
    id: "client-1",
    emit(): void {}
  };

  gateway.handleConnection(client);
  assert.equal(operationsState.snapshot().connectedClients, 1);

  gateway.handleDisconnect(client);
  assert.equal(operationsState.snapshot().connectedClients, 0);
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
  const broadcastBus = new RecordingBroadcastBus();
  const operationsState = new RuntimeWsOperationsState({
    replayStoreMode: "memory",
    broadcastBusMode: "local",
    instanceId: "instance-a"
  });
  operationsState.recordError("broadcast", new Error("previous error"));
  const gateway = new RuntimeWsGateway(replayStore, broadcastBus, "instance-a", operationsState);
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
  assert.equal(operationsState.snapshot().ok, true);
  assert.equal(operationsState.snapshot().lastError, undefined);
  assert.deepEqual(replayStore.saved, [update]);
  assert.deepEqual(broadcastBus.published, [{ event: update, options: { originId: "instance-a" } }]);
  assert.deepEqual(emitted, [
    {
      room: "tenant.tenant-a.page.orders.instance.instance-1",
      event: RUNTIME_MANAGER_EXECUTED_EVENT,
      payload: update
    }
  ]);
});

test("runtime websocket gateway broadcasts replay-id enriched manager updates", async () => {
  const replayStore = new ReplayIdReplayStore();
  const broadcastBus = new RecordingBroadcastBus();
  const gateway = new RuntimeWsGateway(replayStore, broadcastBus, "instance-a");
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  gateway.server = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown): void {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
  const update = createUpdate();
  const enrichedUpdate = { ...update, replayId: "2-0" };

  const result = await gateway.broadcastRuntimeManagerExecuted(update);

  assert.deepEqual(result, enrichedUpdate);
  assert.deepEqual(broadcastBus.published, [{ event: enrichedUpdate, options: { originId: "instance-a" } }]);
  assert.deepEqual(emitted, [
    {
      room: "tenant.tenant-a.page.orders.instance.instance-1",
      event: RUNTIME_MANAGER_EXECUTED_EVENT,
      payload: enrichedUpdate
    }
  ]);
});

test("runtime websocket gateway records replay errors and preserves fail-fast behavior", async () => {
  const operationsState = new RuntimeWsOperationsState({
    replayStoreMode: "memory",
    broadcastBusMode: "local",
    instanceId: "instance-a"
  });
  const gateway = new RuntimeWsGateway(
    new FailingReplayStore(new Error("replay unavailable")),
    new RecordingBroadcastBus(),
    "instance-a",
    operationsState
  );
  const client: WsClientLike = {
    id: "client-1",
    emit(): void {}
  };

  await assert.rejects(
    () =>
      gateway.subscribePage(
        {
          tenantId: "tenant-a",
          pageId: "orders",
          pageInstanceId: "instance-1"
        },
        client
      ),
    /replay unavailable/
  );

  assert.deepEqual(operationsState.snapshot().lastError?.operation, "replay");
  assert.deepEqual(operationsState.snapshot().lastError?.message, "replay unavailable");
  assert.equal(operationsState.snapshot().ok, false);
});

test("runtime websocket gateway records broadcast errors and preserves fail-fast behavior", async () => {
  const operationsState = new RuntimeWsOperationsState({
    replayStoreMode: "memory",
    broadcastBusMode: "local",
    instanceId: "instance-a"
  });
  const gateway = new RuntimeWsGateway(
    new RecordingReplayStore(),
    new FailingBroadcastBus(new Error("broadcast unavailable")),
    "instance-a",
    operationsState
  );

  await assert.rejects(() => gateway.broadcastRuntimeManagerExecuted(createUpdate()), /broadcast unavailable/);

  assert.equal(operationsState.snapshot().lastError?.operation, "broadcast");
  assert.equal(operationsState.snapshot().lastError?.message, "broadcast unavailable");
  assert.equal(operationsState.snapshot().ok, false);
});

test("runtime websocket health controller returns stable operations status", () => {
  const operationsState = new RuntimeWsOperationsState({
    replayStoreMode: "redis",
    broadcastBusMode: "redis",
    instanceId: "instance-health"
  });
  const controller = new RuntimeWsHealthController(operationsState);

  operationsState.clientConnected("client-1");
  const health = controller.health();

  assert.deepEqual(health, {
    ok: true,
    replayStoreMode: "redis",
    broadcastBusMode: "redis",
    instanceId: "instance-health",
    connectedClients: 1
  });
});

test("runtime websocket gateway emits remote broadcast bus events once", async () => {
  const replayStore = new RecordingReplayStore();
  const broadcastBus = new InProcessRuntimeWsBroadcastBus();
  const gateway = new RuntimeWsGateway(replayStore, broadcastBus, "instance-a");
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  gateway.server = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown): void {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
  const update = createUpdate();

  await gateway.onModuleInit();
  await broadcastBus.publish(update, { originId: "instance-b" });
  await gateway.onModuleDestroy();

  assert.deepEqual(replayStore.saved, [update]);
  assert.deepEqual(emitted, [
    {
      room: "tenant.tenant-a.page.orders.instance.instance-1",
      event: RUNTIME_MANAGER_EXECUTED_EVENT,
      payload: update
    }
  ]);
});

test("runtime websocket gateway does not re-save remote events that already have replay ids", async () => {
  const replayStore = new RecordingReplayStore();
  const broadcastBus = new InProcessRuntimeWsBroadcastBus();
  const gateway = new RuntimeWsGateway(replayStore, broadcastBus, "instance-a");
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  gateway.server = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown): void {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
  const update = { ...createUpdate(), replayId: "1-0" };

  await gateway.onModuleInit();
  await broadcastBus.publish(update, { originId: "instance-b" });
  await gateway.onModuleDestroy();

  assert.deepEqual(replayStore.saved, []);
  assert.deepEqual(emitted, [
    {
      room: "tenant.tenant-a.page.orders.instance.instance-1",
      event: RUNTIME_MANAGER_EXECUTED_EVENT,
      payload: update
    }
  ]);
});

test("runtime websocket gateway ignores its own broadcast bus events", async () => {
  const replayStore = new RecordingReplayStore();
  const broadcastBus = new InProcessRuntimeWsBroadcastBus();
  const gateway = new RuntimeWsGateway(replayStore, broadcastBus, "instance-a");
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  gateway.server = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown): void {
          emitted.push({ room, event, payload });
        }
      };
    }
  };

  await gateway.onModuleInit();
  await broadcastBus.publish(createUpdate(), { originId: "instance-a" });
  await gateway.onModuleDestroy();

  assert.deepEqual(replayStore.saved, []);
  assert.deepEqual(emitted, []);
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

test("runtime websocket gateway replays cursor updates after subscription replay id", async () => {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const client: WsClientLike = {
    id: "client-1",
    emit(event: string, payload: unknown): void {
      emitted.push({ event, payload });
    }
  };
  const oldUpdate = { ...createUpdate(), replayId: "1-0" };
  const nextUpdate = { ...createUpdate(), replayId: "2-0", requestId: "req-2" };
  const latestUpdate = { ...createUpdate(), replayId: "3-0", requestId: "req-3" };
  const gateway = new RuntimeWsGateway(new RecordingReplayStore([oldUpdate, nextUpdate, latestUpdate]));

  await gateway.subscribePage(
    {
      tenantId: "tenant-a",
      pageId: "orders",
      pageInstanceId: "instance-1",
      afterReplayId: "1-0"
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
    { event: RUNTIME_MANAGER_EXECUTED_EVENT, payload: nextUpdate },
    { event: RUNTIME_MANAGER_EXECUTED_EVENT, payload: latestUpdate }
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

test("redis stream runtime websocket replay store saves replay ids and reads cursor events", async () => {
  const client = new FakeRedisClient();
  const store = new RedisStreamRuntimeWsReplayStore(client, {
    keyPrefix: "test:stream",
    replayLimit: 1
  });
  const first = createUpdate();
  const second = { ...createUpdate(), requestId: "req-2" };
  const third = { ...createUpdate(), requestId: "req-3" };

  await store.connect();
  const savedFirst = await store.saveLatest(first);
  const savedSecond = await store.saveLatest(second);
  const savedThird = await store.saveLatest(third);

  assert.equal(client.connected, true);
  assert.equal(savedFirst.replayId, "1-0");
  assert.equal(savedSecond.replayId, "2-0");
  assert.equal(savedThird.replayId, "3-0");
  assert.deepEqual(client.xAddCalls[0], {
    key: "test:stream:tenant.tenant-a.page.orders.instance.instance-1",
    id: "*",
    message: { event: JSON.stringify(first) }
  });
  assert.deepEqual(await store.getLatest(first.topic), savedThird);
  assert.deepEqual(await store.getAfter(first.topic, "1-0"), [savedSecond]);
  assert.deepEqual(client.xRangeCalls.at(-1), {
    key: "test:stream:tenant.tenant-a.page.orders.instance.instance-1",
    start: "(1-0",
    end: "+",
    options: { COUNT: 1 }
  });
  assert.equal(await store.getLatest("tenant.tenant-a.page.missing.instance.instance-1"), undefined);
});

test("redis stream runtime websocket replay store fails on invalid payload", async () => {
  const client = new FakeRedisClient();
  client.streams.set("test:stream:tenant.tenant-a.page.orders.instance.instance-1", [
    { id: "1-0", message: { event: JSON.stringify({ topic: "oops" }) } }
  ]);
  const store = new RedisStreamRuntimeWsReplayStore(client, { keyPrefix: "test:stream" });

  await assert.rejects(
    () => store.getLatest("tenant.tenant-a.page.orders.instance.instance-1"),
    /Invalid runtime manager executed replay payload/
  );
});

test("redis stream runtime websocket replay store propagates client errors", async () => {
  const store = new RedisStreamRuntimeWsReplayStore(new FakeRedisClient(new Error("redis down")));

  await assert.rejects(() => store.saveLatest(createUpdate()), /redis down/);
  await assert.rejects(() => store.getAfter("tenant.tenant-a.page.orders.instance.instance-1", "1-0"), /redis down/);
});

test("redis runtime websocket broadcast bus publishes and subscribes manager events", async () => {
  const publisher = new FakeRedisClient();
  const subscriber = new FakeRedisClient();
  const bus = new RedisRuntimeWsBroadcastBus(publisher, subscriber, { channel: "test:broadcast" });
  const received: unknown[] = [];
  const update = createUpdate();

  await bus.connect();
  await bus.subscribe((message) => {
    received.push(message);
  });
  await bus.publish(update, { originId: "instance-a" });
  const listener = subscriber.subscriptions.get("test:broadcast");
  assert.ok(listener);
  await listener(JSON.stringify({ originId: "instance-b", event: update }), "test:broadcast");

  assert.equal(publisher.connected, true);
  assert.equal(subscriber.connected, true);
  assert.deepEqual(publisher.publishCalls, [
    {
      channel: "test:broadcast",
      message: JSON.stringify({ originId: "instance-a", event: update })
    }
  ]);
  assert.deepEqual(received, [{ originId: "instance-b", event: update }]);
});

test("redis runtime websocket broadcast bus fails on invalid payload", async () => {
  const subscriber = new FakeRedisClient();
  const bus = new RedisRuntimeWsBroadcastBus(new FakeRedisClient(), subscriber, { channel: "test:broadcast" });

  await bus.subscribe(() => undefined);
  const listener = subscriber.subscriptions.get("test:broadcast");
  assert.ok(listener);
  await assert.rejects(
    async () => {
      await listener(JSON.stringify({ originId: "instance-b", event: { topic: "oops" } }), "test:broadcast");
    },
    /Invalid runtime manager executed replay payload/
  );
});

test("redis runtime websocket broadcast bus propagates client errors and closes clients", async () => {
  const bus = new RedisRuntimeWsBroadcastBus(new FakeRedisClient(new Error("redis down")), new FakeRedisClient());

  await assert.rejects(() => bus.publish(createUpdate(), { originId: "instance-a" }), /redis down/);

  const publisher = new FakeRedisClient();
  const subscriber = new FakeRedisClient();
  const closeableBus = new RedisRuntimeWsBroadcastBus(publisher, subscriber, { channel: "test:broadcast" });
  await closeableBus.close();

  assert.deepEqual(subscriber.unsubscribedChannels, ["test:broadcast"]);
  assert.equal(subscriber.quitCalled, true);
  assert.equal(publisher.quitCalled, true);
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
  assert.equal(parseRuntimeWsReplayStoreMode("redis-stream"), "redis-stream");
  assert.throws(() => parseRuntimeWsReplayStoreMode("postgres"), /Invalid LC_RUNTIME_WS_REPLAY_STORE/);
});

test("runtime websocket replay limit defaults and rejects invalid values", () => {
  assert.equal(parseRuntimeWsReplayLimit(undefined), 20);
  assert.equal(parseRuntimeWsReplayLimit(""), 20);
  assert.equal(parseRuntimeWsReplayLimit("5"), 5);
  assert.throws(() => parseRuntimeWsReplayLimit("0"), /Invalid LC_RUNTIME_WS_REPLAY_LIMIT/);
  assert.throws(() => parseRuntimeWsReplayLimit("abc"), /Invalid LC_RUNTIME_WS_REPLAY_LIMIT/);
});

test("runtime websocket broadcast bus mode defaults to local and rejects unknown modes", () => {
  assert.equal(parseRuntimeWsBroadcastBusMode(undefined), "local");
  assert.equal(parseRuntimeWsBroadcastBusMode(""), "local");
  assert.equal(parseRuntimeWsBroadcastBusMode("local"), "local");
  assert.equal(parseRuntimeWsBroadcastBusMode("redis"), "redis");
  assert.throws(() => parseRuntimeWsBroadcastBusMode("postgres"), /Invalid LC_RUNTIME_WS_BROADCAST_BUS/);
});
