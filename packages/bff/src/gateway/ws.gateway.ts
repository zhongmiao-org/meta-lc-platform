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
  type RuntimePageTopicRef
} from "@zhongmiao/meta-lc-contracts";
import {
  InMemoryRuntimeWsReplayStore,
  RUNTIME_WS_REPLAY_STORE,
  type RuntimeWsReplayStore
} from "./runtime-ws-replay.store";
import {
  InProcessRuntimeWsBroadcastBus,
  RUNTIME_WS_BROADCAST_BUS,
  RUNTIME_WS_INSTANCE_ID,
  type RuntimeWsBroadcastBus,
  type RuntimeWsBroadcastMessage
} from "./runtime-ws-broadcast.bus";

export interface WsClientLike {
  id: string;
  emit(event: string, payload: unknown): void;
  join?(room: string): void | Promise<void>;
}

export interface WsRoomLike {
  emit(event: string, payload: unknown): void;
}

export interface WsServerLike {
  to(room: string): WsRoomLike;
}

export interface SubscribePageMessage extends RuntimePageTopicRef {}

export interface PageSubscribedEvent extends SubscribePageMessage {
  topic: string;
  status: "subscribed";
}

@WebSocketGateway({ namespace: "runtime" })
export class RuntimeWsGateway
  implements OnModuleInit, OnModuleDestroy, OnGatewayConnection<WsClientLike>, OnGatewayDisconnect<WsClientLike>
{
  private readonly logger = new Logger("RuntimeWsGateway");

  constructor(
    @Optional()
    @Inject(RUNTIME_WS_REPLAY_STORE)
    private readonly replayStore: RuntimeWsReplayStore = new InMemoryRuntimeWsReplayStore(),
    @Optional()
    @Inject(RUNTIME_WS_BROADCAST_BUS)
    private readonly broadcastBus: RuntimeWsBroadcastBus = new InProcessRuntimeWsBroadcastBus(),
    @Optional()
    @Inject(RUNTIME_WS_INSTANCE_ID)
    private readonly instanceId: string = randomUUID()
  ) {}

  @WebSocketServer()
  server?: WsServerLike;

  async onModuleInit(): Promise<void> {
    await this.broadcastBus.subscribe((message) => this.handleBroadcastMessage(message));
  }

  async onModuleDestroy(): Promise<void> {
    await this.broadcastBus.close();
  }

  handleConnection(client: WsClientLike): void {
    this.logger.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: WsClientLike): void {
    this.logger.log(`client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribePage")
  async subscribePage(
    @MessageBody() message: SubscribePageMessage,
    @ConnectedSocket() client: WsClientLike
  ): Promise<PageSubscribedEvent> {
    const event: PageSubscribedEvent = {
      ...message,
      topic: buildPageTopic(message),
      status: "subscribed"
    };
    this.joinTopic(client, event.topic);
    client.emit("pageSubscribed", event);
    const replayEvent = await this.replayStore.getLatest(event.topic);
    if (replayEvent) {
      this.emitRuntimeManagerExecuted(client, replayEvent);
    }
    return event;
  }

  emitRuntimeManagerExecuted(client: WsClientLike, event: RuntimeManagerExecutedEvent): RuntimeManagerExecutedEvent {
    client.emit(RUNTIME_MANAGER_EXECUTED_EVENT, event);
    return event;
  }

  async broadcastRuntimeManagerExecuted(event: RuntimeManagerExecutedEvent): Promise<RuntimeManagerExecutedEvent> {
    await this.replayStore.saveLatest(event);
    this.emitRuntimeManagerExecutedToTopic(event);
    await this.broadcastBus.publish(event, { originId: this.instanceId });
    return event;
  }

  private async handleBroadcastMessage(message: RuntimeWsBroadcastMessage): Promise<void> {
    if (message.originId === this.instanceId) {
      return;
    }
    await this.replayStore.saveLatest(message.event);
    this.emitRuntimeManagerExecutedToTopic(message.event);
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
