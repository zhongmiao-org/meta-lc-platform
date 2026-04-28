import { randomUUID } from "node:crypto";
import { Inject, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import {
  buildRuntimePageTopic,
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type RuntimeManagerExecutedEvent,
} from "@zhongmiao/meta-lc-runtime/core";
import { InMemoryRuntimeWsReplayStore } from "./replay.store";
import { InProcessRuntimeWsBroadcastBus } from "./broadcast.bus";
import { RuntimeWsOperationsState } from "./operations.state";
import {
  RUNTIME_WS_BROADCAST_BUS,
  RUNTIME_WS_INSTANCE_ID,
  RUNTIME_WS_REPLAY_STORE
} from "../../../common/constants/runtime-ws.constant";
import type {
  RuntimeWsBroadcastBus,
  RuntimeWsReplayStore
} from "./runtime-ws.gateway.interface";
import type { WsClientLike, WsServerLike } from "./runtime-ws-client.type";
import type {
  PageSubscribedEvent,
  RuntimeWsBroadcastMessage,
  SubscribePageMessage
} from "./runtime-ws-event.type";

@WebSocketGateway({ namespace: "runtime" })
export class RuntimeWsGateway
  implements OnModuleInit, OnModuleDestroy, OnGatewayConnection<WsClientLike>, OnGatewayDisconnect<WsClientLike>
{
  private readonly logger = new Logger("RuntimeWsGateway");
  private readonly operationsState: RuntimeWsOperationsState;

  constructor(
    @Optional()
    @Inject(RUNTIME_WS_REPLAY_STORE)
    private readonly replayStore: RuntimeWsReplayStore = new InMemoryRuntimeWsReplayStore(),
    @Optional()
    @Inject(RUNTIME_WS_BROADCAST_BUS)
    private readonly broadcastBus: RuntimeWsBroadcastBus = new InProcessRuntimeWsBroadcastBus(),
    @Optional()
    @Inject(RUNTIME_WS_INSTANCE_ID)
    private readonly instanceId: string = randomUUID(),
    @Optional()
    operationsState?: RuntimeWsOperationsState
  ) {
    this.operationsState =
      operationsState ??
      new RuntimeWsOperationsState({
        replayStoreMode: "memory",
        broadcastBusMode: "local",
        instanceId: this.instanceId
      });
  }

  @WebSocketServer()
  server?: WsServerLike;

  async onModuleInit(): Promise<void> {
    await this.broadcastBus.subscribe((message) => this.handleBroadcastMessage(message));
  }

  async onModuleDestroy(): Promise<void> {
    await this.broadcastBus.close();
  }

  handleConnection(client: WsClientLike): void {
    this.operationsState.clientConnected(client.id);
    this.logger.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: WsClientLike): void {
    this.operationsState.clientDisconnected(client.id);
    this.logger.log(`client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribePage")
  async subscribePage(
    @MessageBody() message: SubscribePageMessage,
    @ConnectedSocket() client: WsClientLike
  ): Promise<PageSubscribedEvent> {
    const event: PageSubscribedEvent = {
      tenantId: message.tenantId,
      pageId: message.pageId,
      pageInstanceId: message.pageInstanceId,
      topic: buildPageTopic(message),
      status: "subscribed"
    };
    this.joinTopic(client, event.topic);
    client.emit("pageSubscribed", event);
    try {
      if (message.afterReplayId) {
        const replayEvents = await this.replayStore.getAfter(event.topic, message.afterReplayId);
        this.operationsState.recordSuccess();
        for (const replayEvent of replayEvents) {
          this.emitRuntimeManagerExecuted(client, replayEvent);
        }
        return event;
      }
      const replayEvent = await this.replayStore.getLatest(event.topic);
      this.operationsState.recordSuccess();
      if (replayEvent) {
        this.emitRuntimeManagerExecuted(client, replayEvent);
      }
    } catch (error) {
      this.operationsState.recordError("replay", error);
      throw error;
    }
    return event;
  }

  emitRuntimeManagerExecuted(client: WsClientLike, event: RuntimeManagerExecutedEvent): RuntimeManagerExecutedEvent {
    client.emit(RUNTIME_MANAGER_EXECUTED_EVENT, event);
    return event;
  }

  async broadcastRuntimeManagerExecuted(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    try {
      const savedEvent = await this.replayStore.saveLatest(event);
      this.emitRuntimeManagerExecutedToTopic(savedEvent);
      await this.broadcastBus.publish(savedEvent, { originId: this.instanceId });
      this.operationsState.recordSuccess();
      return savedEvent;
    } catch (error) {
      this.operationsState.recordError("broadcast", error);
      throw error;
    }
  }

  private async handleBroadcastMessage(message: RuntimeWsBroadcastMessage): Promise<void> {
    if (message.originId === this.instanceId) {
      return;
    }
    try {
      const event = message.event.replayId ? message.event : await this.replayStore.saveLatest(message.event);
      this.emitRuntimeManagerExecutedToTopic(event);
      this.operationsState.recordSuccess();
    } catch (error) {
      this.operationsState.recordError("broadcast", error);
      throw error;
    }
  }

  private emitRuntimeManagerExecutedToTopic(event: RuntimeManagerExecutedEvent): void {
    this.server?.to(event.topic).emit(RUNTIME_MANAGER_EXECUTED_EVENT, event);
  }

  private joinTopic(client: WsClientLike, topic: string): void {
    void Promise.resolve(client.join?.(topic)).catch((error) => {
      this.logger.warn(`client ${client.id} failed to join ${topic}: ${String(error)}`);
    });
  }
}

export function buildPageTopic(message: SubscribePageMessage): string {
  return buildRuntimePageTopic(message);
}
