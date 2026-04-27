import type { ViewApiRequest } from "./view.request.type";

export interface ViewRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface ViewResponseLike {
  setHeader(name: string, value: string): void;
}

export interface RuntimeGatewayRunner {
  (viewName: string, request: ViewApiRequest & { requestId: string }): Promise<{ viewModel: Record<string, unknown> }>;
}
