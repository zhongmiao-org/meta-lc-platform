export interface ViewApiRequest {
  tenantId: string;
  userId: string;
  roles: string[];
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ViewApiResponse {
  requestId: string;
  viewModel: Record<string, unknown>;
}
