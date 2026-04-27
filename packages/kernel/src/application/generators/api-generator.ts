import type {
  ApiRouteOperation,
  CompiledApiRoute,
  CompiledApiRouteManifest,
  MetaSchema,
  MetaTable
} from "../../core/types/shared.types";
import { validateSchema } from "../../core/utils";
import { quoteIdentifier } from "../../utils/sql-utils";

export function compileApiRoutes(schema: MetaSchema): CompiledApiRouteManifest {
  validateSchema(schema);

  return {
    source: "meta-schema",
    routes: schema.tables.flatMap((table) => [createRoute(table, "query"), createRoute(table, "mutation")])
  };
}

function createRoute(table: MetaTable, operation: ApiRouteOperation): CompiledApiRoute {
  quoteIdentifier(table.name);

  const isQuery = operation === "query";
  return {
    id: `${table.name}.${operation}`,
    table: table.name,
    operation,
    method: "POST",
    path: `/api/${table.name}/${operation}`,
    target: {
      method: "POST",
      path: isQuery ? "/query" : "/mutation"
    },
    requestContract: isQuery ? "QueryApiRequest" : "MutationApiRequest",
    responseContract: isQuery ? "QueryApiResponse" : "MutationApiResponse"
  };
}
