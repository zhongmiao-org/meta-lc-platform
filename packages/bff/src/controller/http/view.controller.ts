import { Body, Controller, InternalServerErrorException, Param, Post, Req, Res } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { resolveRequestId } from "../../common/request-id";
import { TemporaryViewAdapter } from "../../application/services/temporary-view-adapter.service";
import type { ViewRequestLike, ViewResponseLike } from "../../contracts/interfaces/view-http.interface";
import type { ViewApiRequest, ViewApiResponse } from "../../contracts/types/view.type";

@Controller()
export class ViewController {
  constructor(private readonly temporaryViewAdapter: TemporaryViewAdapter) {}

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
      const result = await this.temporaryViewAdapter.execute(name, request, requestId);
      return {
        requestId,
        viewModel: result.runtime.viewModel
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`runtime execution failed for view "${name}"`);
    }
  }
}
