import type {
  DataScopeDecision,
  OrgScopeContext,
  PermissionContext
} from "./permission.interface";

export interface PermissionAstTransformContext extends PermissionContext {
  orgScope?: OrgScopeContext;
  dataScopeDecision?: DataScopeDecision;
}
