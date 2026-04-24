import { Controller, Get, Req, Res } from "@nestjs/common";
import { AggregationService, type MetaSummary } from "../../application/orchestrator/aggregation.service";
import { CacheService } from "../../infra/cache/cache.service";
import { resolveRequestId } from "../common/request-id";
import { MetaRegistryService } from "./meta-registry.service";
import type {
  MetaListEnvelope,
  MetaRequestLike,
  MetaResponseLike,
  MetaSummaryEnvelope
} from "./contracts/meta.http";
import type { MetaRegistryItem, MetaResourceKind } from "./contracts/meta-registry.contract";

@Controller("meta")
export class MetaController {
  constructor(
    private readonly registry: MetaRegistryService,
    private readonly cache: CacheService,
    private readonly aggregation: AggregationService
  ) {}

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
    const result = await this.cache.remember<MetaSummary>("meta:summary", () => this.aggregation.summarizeMeta());
    return {
      summary: result.value,
      source: "memory",
      cached: result.cached,
      requestId
    };
  }

  private async list(
    kind: MetaResourceKind,
    req: MetaRequestLike,
    res: MetaResponseLike
  ): Promise<MetaListEnvelope<MetaRegistryItem>> {
    const requestId = this.bindRequestId(req, res);
    const result = await this.cache.remember<MetaRegistryItem[]>(`meta:${kind}`, () => this.registry.list(kind));
    return {
      items: result.value,
      source: "memory",
      cached: result.cached,
      requestId
    };
  }

  private bindRequestId(req: MetaRequestLike, res: MetaResponseLike): string {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", requestId);
    return requestId;
  }
}
