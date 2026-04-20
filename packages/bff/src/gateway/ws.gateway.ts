import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";

export interface WsClientLike {
  id: string;
  emit(event: string, payload: unknown): void;
}

export interface SubscribePageMessage {
  tenantId: string;
  pageId: string;
  pageInstanceId: string;
}

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
}

export function buildPageTopic(message: SubscribePageMessage): string {
  return `tenant.${message.tenantId}.page.${message.pageId}.instance.${message.pageInstanceId}`;
}
