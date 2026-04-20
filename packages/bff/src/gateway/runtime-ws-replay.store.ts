import { type RuntimeManagerExecutedEvent } from "@zhongmiao/meta-lc-contracts";
import { createClient } from "redis";

export interface RuntimeWsReplayStore {
  saveLatest(event: RuntimeManagerExecutedEvent): Promise<void>;
  getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined>;
}

export const RUNTIME_WS_REPLAY_STORE = Symbol("RUNTIME_WS_REPLAY_STORE");

export type RuntimeWsReplayStoreMode = "memory" | "redis";

export class InMemoryRuntimeWsReplayStore implements RuntimeWsReplayStore {
  private readonly latestRuntimeEventsByTopic = new Map<string, RuntimeManagerExecutedEvent>();

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<void> {
    this.latestRuntimeEventsByTopic.set(event.topic, event);
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    return this.latestRuntimeEventsByTopic.get(topic);
  }
}

export interface RedisRuntimeWsReplayClient {
  connect?(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
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

  async saveLatest(event: RuntimeManagerExecutedEvent): Promise<void> {
    await this.client.set(this.toKey(event.topic), JSON.stringify(event));
  }

  async getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined> {
    const payload = await this.client.get(this.toKey(topic));
    if (payload === null) {
      return undefined;
    }
    return parseRuntimeManagerExecutedEvent(payload);
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
  }) as RedisRuntimeWsReplayClient;
  const store = new RedisRuntimeWsReplayStore(client);
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
  throw new Error(`Invalid LC_RUNTIME_WS_REPLAY_STORE: ${value}. Expected "memory" or "redis".`);
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
  if (!isRecord(value.patchState)) {
    return false;
  }
  return isStringArray(value.refreshedDatasourceIds) && isStringArray(value.runActionIds);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
