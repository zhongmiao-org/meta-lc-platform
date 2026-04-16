import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { BootstrapService } from "./bootstrap/bootstrap.service";
import { shouldAutoBootstrap } from "./config";

export async function startBffServer(): Promise<void> {
  if (shouldAutoBootstrap()) {
    await new BootstrapService(process.cwd()).run({ failFast: false });
  }
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true
  });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 6000);
}

if (require.main === module) {
  void startBffServer();
}
