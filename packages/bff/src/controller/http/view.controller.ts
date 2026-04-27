import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  Param,
  Post,
  Req,
  Res
} from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import {
  RuntimeGatewayRequestError,
  RuntimeViewNotFoundError,
  executeRuntimeGatewayView
} from "@zhongmiao/meta-lc-runtime";
import { BFF_RUNTIME_GATEWAY_RUNNER } from "../../common/constants/gateway-provider.constant";
import { resolveRequestId } from "../../common/request-id";
import { readGatewayRequestIdHeader } from "../../config/gateway.config";
import type { ViewRequestLike, ViewResponseLike } from "../../interface/view.interface";
import type { RuntimeGatewayRunner, ViewApiRequest, ViewApiResponse } from "../../types/view.type";

@Controller()
export class ViewController {
  constructor(
    @Optional()
    @Inject(BFF_RUNTIME_GATEWAY_RUNNER)
    public runtimeRunner: RuntimeGatewayRunner = executeRuntimeGatewayView
  ) {}

  @Post("view/:name")
  async executeView(
    @Param("name") name: string,
    @Body() request: ViewApiRequest,
    @Req() req: ViewRequestLike,
    @Res({ passthrough: true }) res: ViewResponseLike
  ): Promise<ViewApiResponse> {
    const requestIdHeader = readGatewayRequestIdHeader();
    const requestId = resolveRequestId(req.headers[requestIdHeader]);
    res.setHeader(requestIdHeader, requestId);

    try {
      const runtime = await this.runtimeRunner(name, {
        ...request,
        requestId
      });
      return {
        requestId,
        viewModel: runtime.viewModel
      };
    } catch (error) {
      if (error instanceof RuntimeViewNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof RuntimeGatewayRequestError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`runtime execution failed for view "${name}"`);
    }
  }
}
