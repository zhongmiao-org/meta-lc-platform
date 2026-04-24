import { randomUUID } from "node:crypto";

export function resolveRequestId(headerValue: string | string[] | undefined): string {
  if (Array.isArray(headerValue)) {
    const first = headerValue[0]?.trim();
    if (first) {
      return first;
    }
  }

  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return randomUUID();
}
