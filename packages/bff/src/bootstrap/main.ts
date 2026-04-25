import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

export async function startBffServer(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true
  });
  const port = process.env.PORT ? Number(process.env.PORT) : 6001;
  const host = process.env.HOST?.trim() || "0.0.0.0";
  await app.listen(port, host);
}

if (require.main === module) {
  void startBffServer();
}
