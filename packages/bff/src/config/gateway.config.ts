export function readGatewayPort(env = process.env): number {
  return readPositiveInteger(env.PORT, 6001, "PORT");
}

export function readGatewayHost(env = process.env): string {
  return readOptionalString(env.HOST) ?? "0.0.0.0";
}

export function readGatewayCorsOrigin(env = process.env): boolean | string {
  return readOptionalString(env.LC_BFF_CORS_ORIGIN) ?? true;
}

export function readGatewayRequestIdHeader(env = process.env): string {
  return readOptionalString(env.LC_BFF_REQUEST_ID_HEADER)?.toLowerCase() ?? "x-request-id";
}

export function readGatewayRequestTimeoutMs(env = process.env): number {
  return readPositiveInteger(env.LC_BFF_REQUEST_TIMEOUT_MS, 30_000, "LC_BFF_REQUEST_TIMEOUT_MS");
}

export function readGatewayCacheTtlMs(env = process.env): number {
  return readPositiveInteger(env.LC_BFF_CACHE_TTL_MS, 30_000, "LC_BFF_CACHE_TTL_MS");
}

export function readGatewayRuntimeWsPath(env = process.env): string {
  return readOptionalString(env.LC_RUNTIME_WS_PATH) ?? "/runtime";
}

export function readGatewayRuntimeWsReplayLimit(env = process.env): number {
  return readPositiveInteger(env.LC_RUNTIME_WS_REPLAY_LIMIT, 100, "LC_RUNTIME_WS_REPLAY_LIMIT");
}

export function readGatewayRuntimeWsReplayStore(env = process.env): string | undefined {
  return readOptionalString(env.LC_RUNTIME_WS_REPLAY_STORE);
}

export function readGatewayRuntimeWsBroadcastBus(env = process.env): string | undefined {
  return readOptionalString(env.LC_RUNTIME_WS_BROADCAST_BUS);
}

export function readGatewayRuntimeProviderToken(env = process.env): string {
  return readOptionalString(env.LC_BFF_RUNTIME_PROVIDER_TOKEN) ?? "runtime";
}

export function readGatewayKernelProviderToken(env = process.env): string {
  return readOptionalString(env.LC_BFF_KERNEL_PROVIDER_TOKEN) ?? "kernel";
}

export function readGatewayLogLevel(env = process.env): string {
  return readOptionalString(env.LC_BFF_LOG_LEVEL) ?? "info";
}

function readOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveInteger(value: string | undefined, fallback: number, key: string): number {
  const raw = readOptionalString(value);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
}
