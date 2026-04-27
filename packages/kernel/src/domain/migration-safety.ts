import type { MigrationGuardOptions, MigrationSafetyReport } from "../core/types";

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\s+TABLE\b/i
];

export function createMigrationSafetyReport(
  statements: string[],
  options: MigrationGuardOptions = {}
): MigrationSafetyReport {
  const allowlist = new Set((options.destructiveStatementAllowlist ?? []).map(normalizeStatement));
  const destructiveStatements: string[] = [];
  const blockedStatements: string[] = [];

  for (const statement of statements) {
    if (!isDestructive(statement)) {
      continue;
    }

    destructiveStatements.push(statement);
    const isAllowlisted = allowlist.has(normalizeStatement(statement));
    if (!options.allowDestructive && !isAllowlisted) {
      blockedStatements.push(statement);
    }
  }

  return { destructiveStatements, blockedStatements };
}

export function assertMigrationSafety(
  statements: string[],
  options: MigrationGuardOptions = {}
): MigrationSafetyReport {
  const report = createMigrationSafetyReport(statements, options);
  if (report.blockedStatements.length > 0) {
    throw new Error(
      `Blocked destructive migration statements: ${report.blockedStatements.join(" | ")}`
    );
  }
  return report;
}

function isDestructive(statement: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(statement));
}

function normalizeStatement(statement: string): string {
  return statement.trim().replace(/\s+/g, " ").toUpperCase();
}
