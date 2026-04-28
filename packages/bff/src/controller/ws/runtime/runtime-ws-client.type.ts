export type WsClientLike = {
  id: string;
  emit(event: string, payload: unknown): void;
  join?(room: string): void | Promise<void>;
};

export type WsRoomLike = {
  emit(event: string, payload: unknown): void;
};

export type WsServerLike = {
  to(room: string): WsRoomLike;
};
