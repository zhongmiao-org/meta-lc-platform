import "reflect-metadata";
import { BootstrapService } from "./bootstrap.service";

async function run(): Promise<void> {
  await new BootstrapService(process.cwd()).run({ failFast: true });
}

void run();
