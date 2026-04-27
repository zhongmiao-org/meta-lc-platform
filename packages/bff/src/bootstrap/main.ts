import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule, createBffGatewayModule } from "./app.module";
import {
  readGatewayCorsOrigin,
  readGatewayHost,
  readGatewayPort
} from "../config/gateway.config";
import type { BffGatewayModuleOptions } from "./app-module.type";

export async function startBffServer(options: BffGatewayModuleOptions = {}): Promise<void> {
  const app = await NestFactory.create(
    hasBffGatewayOptions(options) ? createBffGatewayModule(options) : AppModule
  );
  app.enableCors({
    origin: readGatewayCorsOrigin(),
    credentials: true
  });
  await app.listen(readGatewayPort(), readGatewayHost());
}

function hasBffGatewayOptions(options: BffGatewayModuleOptions): boolean {
  return Boolean(options.runtimeRunner || options.metaRegistry);
}

if (require.main === module) {
  void startBffServer();
}
