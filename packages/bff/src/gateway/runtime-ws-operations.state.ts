import { type RuntimeWsBroadcastBusMode } from "./runtime-ws-broadcast.bus";
import { type RuntimeWsReplayStoreMode } from "./runtime-ws-replay.store";

export interface RuntimeWsOperationError {
  operation: "replay" | "broadcast";
  message: string;
  occurredAt: string;
}

export interface RuntimeWsOperationsSnapshot {
  ok: boolean;
  replayStoreMode: RuntimeWsReplayStoreMode;
  broadcastBusMode: RuntimeWsBroadcastBusMode;
  instanceId: string;
  connectedClients: number;
  lastError?: RuntimeWsOperationError;
}

export interface RuntimeWsOperationsStateOptions {
  replayStoreMode: RuntimeWsReplayStoreMode;
  broadcastBusMode: RuntimeWsBroadcastBusMode;
  instanceId: string;
}

export class RuntimeWsOperationsState {
  private readonly connectedClientIds = new Set<string>();
  private lastError?: RuntimeWsOperationError;

  constructor(private readonly options: RuntimeWsOperationsStateOptions) {}

  clientConnected(clientId: string): void {
    this.connectedClientIds.add(clientId);
  }

  clientDisconnected(clientId: string): void {
    this.connectedClientIds.delete(clientId);
  }

  recordSuccess(): void {
    this.lastError = undefined;
  }

  recordError(operation: RuntimeWsOperationError["operation"], error: unknown): void {
    this.lastError = {
      operation,
      message: error instanceof Error ? error.message : String(error),
      occurredAt: new Date().toISOString()
    };
  }

  snapshot(): RuntimeWsOperationsSnapshot {
    return {
      ok: this.lastError === undefined,
      replayStoreMode: this.options.replayStoreMode,
      broadcastBusMode: this.options.broadcastBusMode,
      instanceId: this.options.instanceId,
      connectedClients: this.connectedClientIds.size,
      ...(this.lastError ? { lastError: this.lastError } : {})
    };
  }
}
