import { Controller, Get, Req, Res } from "@nestjs/common";
import { AggregationService, type MetaSummary } from "../aggregation/aggregation.service";
import { CacheService } from "../cache/cache.service";
import { resolveRequestId } from "../common/request-id";
import {
  MetaRegistryService,
  type MetaRegistryItem,
  type MetaResourceKind
} from "./meta-registry.service";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

export interface MetaListEnvelope {
  items: MetaRegistryItem[];
  source: "memory";
  cached: boolean;
  requestId: string;
}

export interface MetaSummaryEnvelope {
  summary: MetaSummary;
  source: "memory";
  cached: boolean;
  requestId: string;
}

@Controller("meta")
export class MetaController {
  constructor(
    private readonly registry: MetaRegistryService,
    private readonly cache: CacheService,
    private readonly aggregation: AggregationService
  ) {}

  @Get("tables")
  tables(@Req() req: RequestLike, @Res({ passthrough: true }) res: ResponseLike): Promise<MetaListEnvelope> {
    return this.list("tables", req, res);
  }

  @Get("pages")
  pages(@Req() req: RequestLike, @Res({ passthrough: true }) res: ResponseLike): Promise<MetaListEnvelope> {
    return this.list("pages", req, res);
  }

  @Get("datasources")
  datasources(
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: ResponseLike
  ): Promise<MetaListEnvelope> {
    return this.list("datasources", req, res);
  }

  @Get("rules")
  rules(@Req() req: RequestLike, @Res({ passthrough: true }) res: ResponseLike): Promise<MetaListEnvelope> {
    return this.list("rules", req, res);
  }

  @Get("permissions")
  permissions(
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: ResponseLike
  ): Promise<MetaListEnvelope> {
    return this.list("permissions", req, res);
  }

  @Get("summary")
  async summary(
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: ResponseLike
  ): Promise<MetaSummaryEnvelope> {
    const requestId = this.bindRequestId(req, res);
    const result = await this.cache.remember("meta:summary", () => this.aggregation.summarizeMeta());
    return {
      summary: result.value,
      source: "memory",
      cached: result.cached,
      requestId
    };
  }

  private async list(kind: MetaResourceKind, req: RequestLike, res: ResponseLike): Promise<MetaListEnvelope> {
    const requestId = this.bindRequestId(req, res);
    const result = await this.cache.remember(`meta:${kind}`, () => this.registry.list(kind));
    return {
      items: result.value,
      source: "memory",
      cached: result.cached,
      requestId
    };
  }

  private bindRequestId(req: RequestLike, res: ResponseLike): string {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", requestId);
    return requestId;
  }
}
