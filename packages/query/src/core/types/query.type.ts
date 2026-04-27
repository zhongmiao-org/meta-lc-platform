import type {
  QueryComparisonPredicate,
  QueryInPredicate,
  QueryIsNullPredicate,
  QueryLiteralPredicate,
  QueryLogicalPredicate
} from "../interfaces";

export type QueryScalarValue = string | number | boolean;

export type QueryComparisonOperator = "eq" | "ilike";

export type QueryPredicate =
  | QueryComparisonPredicate
  | QueryInPredicate
  | QueryIsNullPredicate
  | QueryLiteralPredicate
  | QueryLogicalPredicate;
