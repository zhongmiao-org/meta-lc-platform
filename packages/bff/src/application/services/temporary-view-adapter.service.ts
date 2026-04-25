import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  executeRuntimeView,
  type RuntimeContext,
} from "@zhongmiao/meta-lc-runtime";
import type { ViewDefinition } from "@zhongmiao/meta-lc-runtime";
import { MetaRegistryService } from "./meta-registry.service";
import { OrgScopeService } from "../../infra/integration/org-scope.service";
import { RuntimeViewDependenciesService } from "../../infra/integration/runtime-view-dependencies.service";
import type { ViewApiRequest } from "../../contracts/types/view.type";
import type { TemporaryViewExecutionResult } from "../types/view.type";

@Injectable()
export class TemporaryViewAdapter {
  constructor(
    private readonly registry: MetaRegistryService,
    private readonly orgScopeService: OrgScopeService,
    private readonly runtimeDependencies: RuntimeViewDependenciesService
  ) {}

  async execute(viewName: string, request: ViewApiRequest, requestId: string): Promise<TemporaryViewExecutionResult> {
    const view = await this.lookupView(viewName);
    const runtimeContext = await this.buildRuntimeContext(request, requestId, viewName);
    const runtime = await executeRuntimeView(view, runtimeContext, this.runtimeDependencies.create());

    return {
      requestId,
      viewName,
      runtime
    };
  }

  private async lookupView(viewName: string): Promise<ViewDefinition> {
    const view = await this.registry.getView(viewName);
    if (!view) {
      throw new NotFoundException(`view "${viewName}" not found`);
    }
    return view;
  }

  private async buildRuntimeContext(
    request: ViewApiRequest,
    requestId: string,
    viewName: string
  ): Promise<RuntimeContext> {
    this.ensureAuthRequest(request);
    const orgScope = await this.orgScopeService.resolveContext({
      tenantId: request.tenantId,
      userId: request.userId,
      roles: request.roles
    });
    const requestContext = {
      requestId,
      tenantId: request.tenantId,
      userId: request.userId,
      roles: [...request.roles],
      ...(request.context ?? {})
    };

    return {
      requestId,
      viewName,
      tenantId: request.tenantId,
      userId: request.userId,
      roles: [...request.roles],
      input: { ...(request.input ?? {}) },
      ...(request.context ?? {}),
      context: requestContext,
      auth: {
        tenantId: request.tenantId,
        userId: request.userId,
        roles: [...request.roles]
      },
      orgScope
    };
  }

  private ensureAuthRequest(request: ViewApiRequest): void {
    if (!request.tenantId?.trim() || !request.userId?.trim()) {
      throw new BadRequestException("tenantId and userId are required.");
    }
    if (!Array.isArray(request.roles)) {
      throw new BadRequestException("roles must be an array.");
    }
  }
}
