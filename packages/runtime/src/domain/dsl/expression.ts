import {
  type Expression,
  type ExpressionStateSource,
  ExpressionResolverError
} from "../../core/types";

const EXPRESSION_PATTERN = /\{\{\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*\}\}/g;
const WHOLE_EXPRESSION_PATTERN = /^\{\{\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*\}\}$/;

export function resolveExpression(value: Expression, state: ExpressionStateSource): unknown {
  if (typeof value === "string") {
    return resolveExpressionString(value, state);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveExpression(item, state));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, resolveExpression(nestedValue, state)])
    );
  }

  return value;
}

export function resolveExpressionString(template: string, state: ExpressionStateSource): unknown {
  const wholeExpressionMatch = template.match(WHOLE_EXPRESSION_PATTERN);
  if (wholeExpressionMatch?.[1]) {
    return getExpressionPathValue(wholeExpressionMatch[1], state);
  }

  return template.replace(EXPRESSION_PATTERN, (_match, path: string) => {
    const resolved = getExpressionPathValue(path, state);
    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}

export function getExpressionPathValue(path: string, state: ExpressionStateSource): unknown {
  if (!path.trim()) {
    throw new ExpressionResolverError("Expression path is required.");
  }

  if (state instanceof Map) {
    if (state.has(path)) {
      return state.get(path);
    }
    return getNestedPathValue(path, Object.fromEntries(state.entries()));
  }

  if (isExpressionStateGetter(state)) {
    return state.get(path);
  }

  if (isPlainObject(state)) {
    return getNestedPathValue(path, state);
  }

  throw new ExpressionResolverError("Expression state source must be an object, Map, or get(path) store.");
}

function getNestedPathValue(path: string, source: Record<string, unknown>): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecordLike(current)) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function isExpressionStateGetter(value: unknown): value is { get(path: string): unknown } {
  return typeof value === "object" && value !== null && !(value instanceof Map) && typeof (value as { get?: unknown }).get === "function";
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlainObject(value: unknown): value is Record<string, Expression> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
