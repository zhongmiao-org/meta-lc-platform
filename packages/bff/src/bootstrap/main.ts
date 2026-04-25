import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  readGatewayCorsOrigin,
  readGatewayHost,
  readGatewayPort
} from "../config/gateway.config";

export async function startBffServer(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: readGatewayCorsOrigin(),
    credentials: true
  });
  await app.listen(readGatewayPort(), readGatewayHost());
}

if (require.main === module) {
  void startBffServer();
}
