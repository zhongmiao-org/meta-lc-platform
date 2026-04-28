import type { RuntimeManagerExecutedEvent } from "@zhongmiao/meta-lc-runtime";
import type {
  RuntimeWsBroadcastHandler,
  RuntimeWsBroadcastPublishOptions,
  RedisRuntimeWsStreamEntry
} from "./runtime-ws-event.type";

export interface RuntimeWsBroadcastBus {
  publish(event: RuntimeManagerExecutedEvent, options: RuntimeWsBroadcastPublishOptions): Promise<void>;
  subscribe(handler: RuntimeWsBroadcastHandler): Promise<void>;
  close(): Promise<void>;
}

export interface RedisRuntimeWsBroadcastClient {
  connect?(): Promise<unknown>;
  duplicate?(): RedisRuntimeWsBroadcastClient;
  publish(channel: string, message: string): Promise<unknown>;
  subscribe(
    channel: string,
    listener: (message: string, channel: string) => void | Promise<void>
  ): Promise<unknown>;
  unsubscribe?(channel: string): Promise<unknown>;
  quit?(): Promise<unknown>;
}

export interface RuntimeWsReplayStore {
  saveLatest(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent>;
  getLatest(topic: string): Promise<RuntimeManagerExecutedEvent | undefined>;
  getAfter(topic: string, afterReplayId: string): Promise<RuntimeManagerExecutedEvent[]>;
}

export interface RedisRuntimeWsReplayClient {
  connect?(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
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
