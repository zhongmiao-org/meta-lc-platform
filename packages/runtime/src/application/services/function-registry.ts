import type {
  RuntimeFunctionExecutionContext,
  RuntimeFunctionRegistry
} from "../../core/interfaces";
import type { RuntimeFunctionHandler } from "../../core/types";
import { RuntimeFunctionRegistryError } from "../../core/errors";

class DefaultRuntimeFunctionRegistry implements RuntimeFunctionRegistry {
  private readonly handlers = new Map<string, RuntimeFunctionHandler>();

  register(name: string, handler: RuntimeFunctionHandler): void {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new RuntimeFunctionRegistryError("Function name is required.");
    }
    this.handlers.set(normalizedName, handler);
  }

  async exec(name: string, args: unknown[], context: RuntimeFunctionExecutionContext): Promise<unknown> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new RuntimeFunctionRegistryError(`Runtime function "${name}" is not registered.`);
    }
    return handler(args, context);
  }
}

export function createFunctionRegistry(): RuntimeFunctionRegistry {
  const registry = new DefaultRuntimeFunctionRegistry();

  registry.register("eq", ([left, right]) => left === right);
  registry.register("notEmpty", ([value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string" || Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  });
  registry.register("includes", ([collection, value]) => {
    if (typeof collection === "string") {
      return collection.includes(String(value ?? ""));
    }
    if (Array.isArray(collection)) {
      return collection.includes(value);
    }
    return false;
  });

  return registry;
}
