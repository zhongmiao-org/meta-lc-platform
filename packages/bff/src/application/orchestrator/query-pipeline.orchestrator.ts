import { resolveDataScope } from "@zhongmiao/meta-lc-permission";
import type { QueryApiRequest } from "@zhongmiao/meta-lc-contracts";
import {
  compileQueryWithPermission as compileQueryWithScopedPermission,
  QueryOrchestratorService as QueryPipelineService
} from "./query.orchestrator";

export { QueryPipelineService };

function compileQueryWithPermission(request: QueryApiRequest): {
  sql: string;
  params: Array<string | number | boolean | string[]>;
} {
  const decision = resolveDataScope({
    tenantId: request.tenantId,
    userId: request.userId,
    roles: request.roles,
    userOrgIds: [],
    rolePolicies: [],
    orgNodes: []
  });

  return compileQueryWithScopedPermission(request, decision);
}
