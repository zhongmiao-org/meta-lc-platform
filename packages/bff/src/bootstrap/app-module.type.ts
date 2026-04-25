import type { RuntimeGatewayRunner } from "../controller/http/view.type";
import type { MetaRegistryProvider } from "../infra/integration/meta-registry.type";

export type BffGatewayModuleOptions = {
  runtimeRunner?: RuntimeGatewayRunner;
  metaRegistry?: MetaRegistryProvider;
};
