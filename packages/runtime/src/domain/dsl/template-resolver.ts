import type { RuntimeTemplateDependency } from "../../types";

const STATE_TEMPLATE_PATTERN = /\{\{\s*state\.([a-zA-Z0-9_]+)\s*\}\}/g;

export function collectTemplateDependencies(value: unknown): RuntimeTemplateDependency[] {
  const seen = new Set<string>();
  const dependencies: RuntimeTemplateDependency[] = [];

  visitTemplateValue(value, (template) => {
    for (const match of template.matchAll(STATE_TEMPLATE_PATTERN)) {
      const key = match[1];
      if (!key) {
        continue;
      }
      const identity = `state:${key}`;
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);
      dependencies.push({
        source: "state",
        key,
        expression: match[0]
      });
    }
  });

  return dependencies;
}

export function resolveTemplateValue(value: unknown, state: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return resolveTemplateString(value, state);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, state));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, resolveTemplateValue(nestedValue, state)])
    );
  }

  return value;
}

export function resolveTemplateString(template: string, state: Record<string, unknown>): string {
  return template.replace(STATE_TEMPLATE_PATTERN, (_match, key: string) => {
    const resolved = state[key];
    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}

function visitTemplateValue(value: unknown, onString: (template: string) => void): void {
  if (typeof value === "string") {
    onString(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => visitTemplateValue(item, onString));
    return;
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => visitTemplateValue(item, onString));
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
