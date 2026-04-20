import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import {
  buildRuntimePageTopic,
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type RuntimeManagerExecutedEvent,
  type RuntimePageTopicRef
} from "@zhongmiao/meta-lc-contracts";

export interface WsClientLike {
  id: string;
  emit(event: string, payload: unknown): void;
}

export interface SubscribePageMessage extends RuntimePageTopicRef {}

export interface PageSubscribedEvent extends SubscribePageMessage {
  topic: string;
  status: "subscribed";
}

@WebSocketGateway({ namespace: "runtime" })
export class RuntimeWsGateway implements OnGatewayConnection<WsClientLike>, OnGatewayDisconnect<WsClientLike> {
  private readonly logger = new Logger("RuntimeWsGateway");

  handleConnection(client: WsClientLike): void {
    this.logger.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: WsClientLike): void {
    this.logger.log(`client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribePage")
  subscribePage(
    @MessageBody() message: SubscribePageMessage,
    @ConnectedSocket() client: WsClientLike
  ): PageSubscribedEvent {
    const event: PageSubscribedEvent = {
      ...message,
      topic: buildPageTopic(message),
      status: "subscribed"
    };
    client.emit("pageSubscribed", event);
    return event;
  }

  emitRuntimeManagerExecuted(client: WsClientLike, event: RuntimeManagerExecutedEvent): RuntimeManagerExecutedEvent {
    client.emit(RUNTIME_MANAGER_EXECUTED_EVENT, event);
    return event;
  }
}

export function buildPageTopic(message: SubscribePageMessage): string {
  return buildRuntimePageTopic(message);
}
