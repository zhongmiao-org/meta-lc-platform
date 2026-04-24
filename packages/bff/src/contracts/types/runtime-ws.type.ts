import type {
  RuntimeManagerExecutedEvent,
  RuntimePageTopicRef
} from "@zhongmiao/meta-lc-contracts";

export type RuntimeWsBroadcastMessage = {
  originId: string;
  event: RuntimeManagerExecutedEvent;
};

export type RuntimeWsBroadcastPublishOptions = {
  originId: string;
};

export type RuntimeWsBroadcastHandler = (message: RuntimeWsBroadcastMessage) => void | Promise<void>;

export type RuntimeWsBroadcastBusMode = "local" | "redis";

export type RedisRuntimeWsBroadcastBusOptions = {
  channel?: string;
};

export type RuntimeWsReplayStoreMode = "memory" | "redis" | "redis-stream";

export type RedisRuntimeWsStreamEntry = {
  id: string;
  message: Record<string, string | undefined>;
};

export type RedisRuntimeWsReplayStoreOptions = {
  keyPrefix?: string;
};

export type RedisStreamRuntimeWsReplayStoreOptions = {
  keyPrefix?: string;
  replayLimit?: number;
};

export type RuntimeWsOperationError = {
  operation: "replay" | "broadcast";
  message: string;
  occurredAt: string;
};

export type RuntimeWsOperationsSnapshot = {
  ok: boolean;
  replayStoreMode: RuntimeWsReplayStoreMode;
  broadcastBusMode: RuntimeWsBroadcastBusMode;
  instanceId: string;
  connectedClients: number;
  lastError?: RuntimeWsOperationError;
};

export type RuntimeWsOperationsStateOptions = {
  replayStoreMode: RuntimeWsReplayStoreMode;
  broadcastBusMode: RuntimeWsBroadcastBusMode;
  instanceId: string;
};

export type SubscribePageMessage = RuntimePageTopicRef & {
  afterReplayId?: string;
};

export type PageSubscribedEvent = RuntimePageTopicRef & {
  topic: string;
  status: "subscribed";
};
