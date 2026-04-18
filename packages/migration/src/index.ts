import {
  assertMigrationSafety,
  compileMigrationDslToSql,
  type MigrationDslV1,
  type MigrationExecutionOptions
} from "@zhongmiao/meta-lc-kernel";

export interface CompiledSqlBundle {
  up: string[];
  down: string[];
}

export interface MigrationApplyResult {
  statements: string[];
  blockedStatements: string[];
  appliedCount: number;
}

export type SqlExecutor = (statement: string) => Promise<void>;

export function compileToSql(dsl: MigrationDslV1): CompiledSqlBundle {
  const compiled = compileMigrationDslToSql(dsl);
  return {
    up: compiled.up,
    down: compiled.down
  };
}

export async function apply(
  target: "meta" | "business" | "audit",
  statements: string[],
  execute: SqlExecutor,
  options: MigrationExecutionOptions = {}
): Promise<MigrationApplyResult> {
  const report = assertMigrationSafety(statements, {
    allowDestructive: options.allowDestructive,
    destructiveStatementAllowlist: options.destructiveStatementAllowlist
  });

  let appliedCount = 0;
  for (const statement of statements) {
    await execute(statement);
    appliedCount += 1;
  }

  return {
    statements,
    blockedStatements: report.blockedStatements,
    appliedCount
  };
}

export function toTargetTag(target: "meta" | "business" | "audit"): string {
  return `migration:${target}`;
}
