import { Controller, Get, Req, Res } from "@nestjs/common";
import { resolveRequestId } from "../../common/request-id";
import { MetaQueryService } from "../../application/services/meta-query.service";
import type { MetaRequestLike, MetaResponseLike } from "../../contracts/interfaces/meta-http.interface";
import type { MetaListEnvelope, MetaSummaryEnvelope } from "../../contracts/types/meta-http.type";
import type {
  MetaRegistryItem,
  MetaResourceKind
} from "../../contracts/types/meta-registry.type";
import type { MetaSummary } from "../../application/types/meta-summary.type";

@Controller("meta")
export class MetaController {
  constructor(private readonly metaQueryService: MetaQueryService) {}

  @Get("tables")
  tables(
    @Req() req: MetaRequestLike,
    @Res({ passthrough: true }) res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    return this.list("tables", req, res);
  }

  @Get("pages")
  pages(
    @Req() req: MetaRequestLike,
    @Res({ passthrough: true }) res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    return this.list("pages", req, res);
  }

  @Get("datasources")
  datasources(
    @Req() req: MetaRequestLike,
    @Res({ passthrough: true }) res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    return this.list("datasources", req, res);
  }

  @Get("rules")
  rules(
    @Req() req: MetaRequestLike,
    @Res({ passthrough: true }) res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    return this.list("rules", req, res);
  }

  @Get("permissions")
  permissions(
    @Req() req: MetaRequestLike,
    @Res({ passthrough: true }) res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    return this.list("permissions", req, res);
  }

  @Get("summary")
  async summary(
    @Req() req: MetaRequestLike,
    @Res({ passthrough: true }) res: MetaResponseLike
  ): Promise<MetaSummaryEnvelope<MetaSummary>> {
    const requestId = this.bindRequestId(req, res);
    return this.metaQueryService.summary(requestId);
  }

  private async list(
    kind: MetaResourceKind,
    req: MetaRequestLike,
    res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    const requestId = this.bindRequestId(req, res);
    return this.metaQueryService.list(kind, requestId);
  }

  private bindRequestId(req: MetaRequestLike, res: MetaResponseLike): string {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", requestId);
    return requestId;
  }
}
