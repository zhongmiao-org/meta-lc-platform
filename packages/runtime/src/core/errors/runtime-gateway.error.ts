export class RuntimeViewNotFoundError extends Error {
  constructor(viewName: string) {
    super(`view "${viewName}" not found`);
    this.name = "RuntimeViewNotFoundError";
  }
}

export class RuntimeGatewayRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeGatewayRequestError";
  }
}
