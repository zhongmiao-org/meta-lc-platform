import type { RuntimeManagerExecutedEvent } from "@zhongmiao/meta-lc-contracts";
import { createClient } from "redis";
import { parseRuntimeManagerExecutedEvent } from "./replay.store";
import type {
  RedisRuntimeWsBroadcastClient,
  RuntimeWsBroadcastBus
} from "../../../contracts/interfaces/runtime-ws.interface";
import type {
  RedisRuntimeWsBroadcastBusOptions,
  RuntimeWsBroadcastBusMode,
  RuntimeWsBroadcastHandler,
  RuntimeWsBroadcastMessage,
  RuntimeWsBroadcastPublishOptions
} from "../../../contracts/types/runtime-ws.type";

export class InProcessRuntimeWsBroadcastBus implements RuntimeWsBroadcastBus {
  private readonly handlers = new Set<RuntimeWsBroadcastHandler>();

  async publish(event: RuntimeManagerExecutedEvent, options: RuntimeWsBroadcastPublishOptions): Promise<void> {
    const message: RuntimeWsBroadcastMessage = { originId: options.originId, event };
    for (const handler of this.handlers) {
      await handler(message);
    }
  }

  async subscribe(handler: RuntimeWsBroadcastHandler): Promise<void> {
    this.handlers.add(handler);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}

export class RedisRuntimeWsBroadcastBus implements RuntimeWsBroadcastBus {
  private readonly channel: string;

  constructor(
    private readonly publisher: RedisRuntimeWsBroadcastClient,
    private readonly subscriber: RedisRuntimeWsBroadcastClient,
    options: RedisRuntimeWsBroadcastBusOptions = {}
  ) {
    this.channel = options.channel ?? "runtime:ws:broadcast";
  }

  async connect(): Promise<void> {
    await this.publisher.connect?.();
    await this.subscriber.connect?.();
  }

  async publish(event: RuntimeManagerExecutedEvent, options: RuntimeWsBroadcastPublishOptions): Promise<void> {
    await this.publisher.publish(this.channel, JSON.stringify({ originId: options.originId, event }));
  }

  async subscribe(handler: RuntimeWsBroadcastHandler): Promise<void> {
    await this.subscriber.subscribe(this.channel, async (message) => {
      await handler(parseRuntimeWsBroadcastMessage(message));
    });
  }

  async close(): Promise<void> {
    await this.subscriber.unsubscribe?.(this.channel);
    await this.subscriber.quit?.();
    await this.publisher.quit?.();
  }
}

export async function createRuntimeWsBroadcastBusFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Promise<RuntimeWsBroadcastBus> {
  const mode = parseRuntimeWsBroadcastBusMode(env.LC_RUNTIME_WS_BROADCAST_BUS);
  if (mode === "local") {
    return new InProcessRuntimeWsBroadcastBus();
  }

  const redisOptions = {
    socket: {
      host: env.REDIS_HOST || "127.0.0.1",
      port: Number(env.REDIS_PORT || 6379)
    },
    password: env.REDIS_PASSWORD || undefined
  };
  const publisher = createClient(redisOptions) as RedisRuntimeWsBroadcastClient;
  const subscriber = (publisher.duplicate?.() ?? createClient(redisOptions)) as RedisRuntimeWsBroadcastClient;
  const bus = new RedisRuntimeWsBroadcastBus(publisher, subscriber);
  await bus.connect();
  return bus;
}

export function parseRuntimeWsBroadcastBusMode(value: string | undefined): RuntimeWsBroadcastBusMode {
  if (value === undefined || value === "" || value === "local") {
    return "local";
  }
  if (value === "redis") {
    return "redis";
  }
  throw new Error(`Invalid LC_RUNTIME_WS_BROADCAST_BUS: ${value}. Expected "local" or "redis".`);
}

export function parseRuntimeWsBroadcastMessage(payload: string): RuntimeWsBroadcastMessage {
  const parsed: unknown = JSON.parse(payload);
  if (!isRuntimeWsBroadcastMessageShape(parsed)) {
    throw new Error("Invalid runtime WebSocket broadcast payload.");
  }
  return {
    originId: parsed.originId,
    event: parseRuntimeManagerExecutedEvent(JSON.stringify(parsed.event))
  };
}

function isRuntimeWsBroadcastMessageShape(value: unknown): value is {
  originId: string;
  event: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { originId?: unknown }).originId === "string"
  );
}
