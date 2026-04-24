export type QueryScalarValue = string | number | boolean;

export interface QueryRequest {
  table: string;
  fields: string[];
  filters?: Record<string, QueryScalarValue>;
  limit?: number;
}

export interface CompiledQuery {
  sql: string;
  params: QueryScalarValue[];
}

export interface QueryTableRef {
  name: string;
  alias?: string;
}

export interface QueryFieldRef {
  name: string;
  tableAlias?: string;
}

export interface QuerySelectItem extends QueryFieldRef {
  alias?: string;
}

export type QueryComparisonOperator = "eq" | "ilike";

export interface QueryComparisonPredicate {
  type: "comparison";
  left: QueryFieldRef;
  operator: QueryComparisonOperator;
  value: QueryScalarValue;
}

export interface QueryLogicalPredicate {
  type: "logical";
  operator: "and" | "or";
  predicates: QueryPredicate[];
}

export type QueryPredicate = QueryComparisonPredicate | QueryLogicalPredicate;

export interface SelectQueryAst {
  type: "select";
  table: QueryTableRef;
  fields: QuerySelectItem[];
  where?: QueryPredicate;
  limit: number;
}
