import { BadRequestException, Body, Controller, InternalServerErrorException, NotFoundException, Param, Post, Req, Res } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { executeRuntimeView, type RuntimeContext } from "@zhongmiao/meta-lc-runtime";
import { resolveRequestId } from "../../common/request-id";
import { MetaRegistryService } from "../../infra/integration/meta-registry.service";
import { OrgScopeService } from "../../infra/integration/org-scope.service";
import { RuntimeViewDependenciesService } from "../../infra/integration/runtime-view-dependencies.service";
import type { ViewRequestLike, ViewResponseLike } from "../../contracts/interfaces/view-http.interface";
import type { ViewApiRequest, ViewApiResponse } from "../../contracts/types/view.type";

@Controller()
export class ViewController {
  constructor(
    private readonly registry: MetaRegistryService,
    private readonly orgScopeService: OrgScopeService,
    private readonly runtimeDependencies: RuntimeViewDependenciesService
  ) {}

  @Post("view/:name")
  async executeView(
    @Param("name") name: string,
    @Body() request: ViewApiRequest,
    @Req() req: ViewRequestLike,
    @Res({ passthrough: true }) res: ViewResponseLike
  ): Promise<ViewApiResponse> {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", requestId);

    try {
      const view = await this.registry.getView(name);
      if (!view) {
        throw new NotFoundException(`view "${name}" not found`);
      }
      const runtimeContext = await this.buildRuntimeContext(request, requestId, name);
      const runtime = await executeRuntimeView(view, runtimeContext, this.runtimeDependencies.create());
      return {
        requestId,
        viewModel: runtime.viewModel
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`runtime execution failed for view "${name}"`);
    }
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
