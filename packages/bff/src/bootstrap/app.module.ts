import { randomUUID } from "node:crypto";
import { Module, type DynamicModule, type ModuleMetadata, type Provider } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { executeRuntimeGatewayView } from "@zhongmiao/meta-lc-runtime";
import { CacheService } from "../infra/cache/cache.service";
import { HttpExceptionFilter } from "../common/http-exception.filter";
import {
  readGatewayRuntimeWsBroadcastBus,
  readGatewayRuntimeWsReplayStore
} from "../config/gateway.config";
import { MetaController } from "../controller/http/meta.controller";
import { ViewController } from "../controller/http/view.controller";
import {
  createRuntimeWsBroadcastBusFromEnv,
  parseRuntimeWsBroadcastBusMode,
} from "../controller/ws/runtime/broadcast.bus";
import {
  RUNTIME_WS_BROADCAST_BUS,
  RUNTIME_WS_INSTANCE_ID,
  RUNTIME_WS_REPLAY_STORE
} from "../common/constants/runtime-ws.constant";
import { HealthController } from "../controller/http/health.controller";
import { RuntimeWsHealthController } from "../controller/ws/runtime/health.controller";
import { RuntimeWsOperationsState } from "../controller/ws/runtime/operations.state";
import {
  createRuntimeWsReplayStoreFromEnv,
  parseRuntimeWsReplayStoreMode
} from "../controller/ws/runtime/replay.store";
import { RuntimeWsGateway } from "../controller/ws/runtime/ws.gateway";
import {
  BFF_META_REGISTRY_PROVIDER,
  BFF_RUNTIME_GATEWAY_RUNNER
} from "../common/constants/gateway-provider.constant";
import { MetaRegistryService } from "../infra/integration/meta-registry.service";
import {
  createEmptyMetaRegistryProvider
} from "../infra/integration/meta-registry.service";
import type { BffGatewayModuleOptions } from "./app-module.type";

@Module(createBffGatewayModuleMetadata())
export class AppModule {}

export function createBffGatewayModule(options: BffGatewayModuleOptions = {}): DynamicModule {
  return {
    module: AppModule,
    ...createBffGatewayModuleMetadata(options)
  };
}

function createBffGatewayModuleMetadata(options: BffGatewayModuleOptions = {}): ModuleMetadata {
  return {
    imports: [],
    controllers: [HealthController, ViewController, MetaController, RuntimeWsHealthController],
    providers: [
      ...createBffGatewayProviders(options),
      CacheService,
      MetaRegistryService,
      {
        provide: RUNTIME_WS_INSTANCE_ID,
        useFactory: () => randomUUID()
      },
      {
        provide: RuntimeWsOperationsState,
        useFactory: (instanceId: string) =>
          new RuntimeWsOperationsState({
            replayStoreMode: parseRuntimeWsReplayStoreMode(readGatewayRuntimeWsReplayStore()),
            broadcastBusMode: parseRuntimeWsBroadcastBusMode(readGatewayRuntimeWsBroadcastBus()),
            instanceId
          }),
        inject: [RUNTIME_WS_INSTANCE_ID]
      },
      {
        provide: RUNTIME_WS_REPLAY_STORE,
        useFactory: () => createRuntimeWsReplayStoreFromEnv()
      },
      {
        provide: RUNTIME_WS_BROADCAST_BUS,
        useFactory: () => createRuntimeWsBroadcastBusFromEnv()
      },
      RuntimeWsGateway,
      {
        provide: APP_FILTER,
        useClass: HttpExceptionFilter
      }
    ]
  };
}

function createBffGatewayProviders(options: BffGatewayModuleOptions): Provider[] {
  return [
    {
      provide: BFF_RUNTIME_GATEWAY_RUNNER,
      useValue: options.runtimeRunner ?? executeRuntimeGatewayView
    },
    {
      provide: BFF_META_REGISTRY_PROVIDER,
      useValue: options.metaRegistry ?? createEmptyMetaRegistryProvider()
    }
  ];
}
