import type {
  RuntimeWsOperationError,
  RuntimeWsOperationsSnapshot,
  RuntimeWsOperationsStateOptions
} from "../../../types/runtime-ws.type";

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
