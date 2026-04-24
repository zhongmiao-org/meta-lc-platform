export type ViewApiRequest = {
  tenantId: string;
  userId: string;
  roles: string[];
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type ViewApiResponse = {
  requestId: string;
  viewModel: Record<string, unknown>;
};
