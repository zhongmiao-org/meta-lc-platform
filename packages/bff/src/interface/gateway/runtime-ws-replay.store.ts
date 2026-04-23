import { type RuntimeManagerExecutedEvent } from "@zhongmiao/meta-lc-contracts";
import { createClient } from "redis";

export interface RuntimeWsReplayStore {
  saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent>;
  getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined>;
  getAfter(topic: string, afterReplayId: string): Promise<RuntimeManagerExecutedEvent[]>;
}

export const RUNTIME_WS_REPLAY_STORE = Symbol("RUNTIME_WS_REPLAY_STORE");

export type RuntimeWsReplayStoreMode = "memory" | "redis" | "redis-stream";

export class InMemoryRuntimeWsReplayStore implements RuntimeWsReplayStore {
  private readonly latestRuntimeEventsByTopic = new Map<string, RuntimeManagerExecutedEvent>();

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    this.latestRuntimeEventsByTopic.set(event.topic, event);
    return event;
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    return this.latestRuntimeEventsByTopic.get(topic);
  }

  async getAfter(): Promise<RuntimeManagerExecutedEvent[]> {
    return [];
  }
}

export interface RedisRuntimeWsReplayClient {
  connect?(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export interface RedisRuntimeWsStreamEntry {
  id: string;
  message: Record<string, string | undefined>;
}

export interface RedisRuntimeWsStreamReplayClient {
  connect?(): Promise<unknown>;
  xAdd(key: string, id: string, message: Record<string, string>): Promise<string>;
  xRange(
    key: string,
    start: string,
    end: string,
    options?: { COUNT?: number }
  ): Promise<RedisRuntimeWsStreamEntry[]>;
  xRevRange(
    key: string,
    start: string,
    end: string,
    options?: { COUNT?: number }
  ): Promise<RedisRuntimeWsStreamEntry[]>;
}

export interface RedisRuntimeWsReplayStoreOptions {
  keyPrefix?: string;
}

export class RedisRuntimeWsReplayStore implements RuntimeWsReplayStore {
  private readonly keyPrefix: string;

  constructor(
    private readonly client: RedisRuntimeWsReplayClient,
    options: RedisRuntimeWsReplayStoreOptions = {}
  ) {
    this.keyPrefix = options.keyPrefix ?? "runtime:ws:replay";
  }

  async connect(): Promise<void> {
    await this.client.connect?.();
  }

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    await this.client.set(this.toKey(event.topic), JSON.stringify(event));
    return event;
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    const payload = await this.client.get(this.toKey(topic));
    if (payload === null) {
      return undefined;
    }
    return parseRuntimeManagerExecutedEvent(payload);
  }

  async getAfter(): Promise<RuntimeManagerExecutedEvent[]> {
    return [];
  }

  private toKey(topic: string): string {
    return `${this.keyPrefix}:${topic}`;
  }
}

export interface RedisStreamRuntimeWsReplayStoreOptions {
  keyPrefix?: string;
  replayLimit?: number;
}

export class RedisStreamRuntimeWsReplayStore implements RuntimeWsReplayStore {
  private readonly keyPrefix: string;
  private readonly replayLimit: number;

  constructor(
    private readonly client: RedisRuntimeWsStreamReplayClient,
    options: RedisStreamRuntimeWsReplayStoreOptions = {}
  ) {
    this.keyPrefix = options.keyPrefix ?? "runtime:ws:stream";
    this.replayLimit = options.replayLimit ?? 20;
  }

  async connect(): Promise<void> {
    await this.client.connect?.();
  }

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    const replayId = await this.client.xAdd(this.toKey(event.topic), "*", {
      event: JSON.stringify(stripReplayId(event))
    });
    return { ...event, replayId };
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    const entries = await this.client.xRevRange(this.toKey(topic), "+", "-", { COUNT: 1 });
    return entries[0] ? parseRuntimeManagerExecutedStreamEntry(entries[0]) : undefined;
  }

  async getAfter(topic: string, afterReplayId: string): Promise<RuntimeManagerExecutedEvent[]> {
    const entries = await this.client.xRange(this.toKey(topic), `(${afterReplayId}`, "+", {
      COUNT: this.replayLimit
    });
    return entries.map((entry) => parseRuntimeManagerExecutedStreamEntry(entry));
  }

  private toKey(topic: string): string {
    return `${this.keyPrefix}:${topic}`;
  }
}

export async function createRuntimeWsReplayStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Promise<RuntimeWsReplayStore> {
  const mode = parseRuntimeWsReplayStoreMode(env.LC_RUNTIME_WS_REPLAY_STORE);
  if (mode === "memory") {
    return new InMemoryRuntimeWsReplayStore();
  }

  const client = createClient({
    socket: {
      host: env.REDIS_HOST || "127.0.0.1",
      port: Number(env.REDIS_PORT || 6379)
    },
    password: env.REDIS_PASSWORD || undefined
  });
  const store =
    mode === "redis"
      ? new RedisRuntimeWsReplayStore(client as RedisRuntimeWsReplayClient)
      : new RedisStreamRuntimeWsReplayStore(client as RedisRuntimeWsStreamReplayClient, {
          replayLimit: parseRuntimeWsReplayLimit(env.LC_RUNTIME_WS_REPLAY_LIMIT)
        });
  await store.connect();
  return store;
}

export function parseRuntimeWsReplayStoreMode(value: string | undefined): RuntimeWsReplayStoreMode {
  if (value === undefined || value === "" || value === "memory") {
    return "memory";
  }
  if (value === "redis") {
    return "redis";
  }
  if (value === "redis-stream") {
    return "redis-stream";
  }
  throw new Error(`Invalid LC_RUNTIME_WS_REPLAY_STORE: ${value}. Expected "memory", "redis", or "redis-stream".`);
}

export function parseRuntimeWsReplayLimit(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 20;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid LC_RUNTIME_WS_REPLAY_LIMIT: ${value}. Expected a positive integer.`);
  }
  return parsed;
}

export function parseRuntimeManagerExecutedEvent(payload: string): RuntimeManagerExecutedEvent {
  const parsed: unknown = JSON.parse(payload);
  if (!isRuntimeManagerExecutedEvent(parsed)) {
    throw new Error("Invalid runtime manager executed replay payload.");
  }
  return parsed;
}

function isRuntimeManagerExecutedEvent(value: unknown): value is RuntimeManagerExecutedEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (value.type !== "runtime.manager.executed" || typeof value.topic !== "string") {
    return false;
  }
  if (!isRecord(value.page)) {
    return false;
  }
  if (
    typeof value.page.tenantId !== "string" ||
    typeof value.page.pageId !== "string" ||
    typeof value.page.pageInstanceId !== "string"
  ) {
    return false;
  }
  if (value.requestId !== undefined && typeof value.requestId !== "string") {
    return false;
  }
  if (value.replayId !== undefined && typeof value.replayId !== "string") {
    return false;
  }
  if (!isRecord(value.patchState)) {
    return false;
  }
  return isStringArray(value.refreshedDatasourceIds) && isStringArray(value.runActionIds);
}

function parseRuntimeManagerExecutedStreamEntry(entry: RedisRuntimeWsStreamEntry): RuntimeManagerExecutedEvent {
  const payload = entry.message.event;
  if (payload === undefined) {
    throw new Error("Invalid runtime manager executed stream payload.");
  }
  return { ...parseRuntimeManagerExecutedEvent(payload), replayId: entry.id };
}

function stripReplayId(event: RuntimeManagerExecutedEvent): RuntimeManagerExecutedEvent {
  const { replayId: _replayId, ...eventWithoutReplayId } = event;
  return eventWithoutReplayId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
