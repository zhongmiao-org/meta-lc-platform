import type { RuntimePageTopicRef } from "../interfaces";

export function buildRuntimePageTopic(ref: RuntimePageTopicRef): string {
  return `tenant.${ref.tenantId}.page.${ref.pageId}.instance.${ref.pageInstanceId}`;
}
