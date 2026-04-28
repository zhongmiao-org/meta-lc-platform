import type { RuntimeGatewayRunner } from "../controller/http/view.gateway.interface";
import type { MetaRegistryProvider } from "../infra/integration/meta-registry-client.interface";

export type BffGatewayModuleOptions = {
  runtimeRunner?: RuntimeGatewayRunner;
  metaRegistry?: MetaRegistryProvider;
};
