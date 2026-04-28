import type { MigrationGuardOptions, MigrationSafetyReport } from "../../core/interfaces";
import {
  assertMigrationSafety as assertMigrationSafetyDomain,
  createMigrationSafetyReport as createMigrationSafetyReportDomain
} from "../../domain";

export function createMigrationSafetyReport(
  statements: string[],
  options: MigrationGuardOptions = {}
): MigrationSafetyReport {
  return createMigrationSafetyReportDomain(statements, options);
}

export function assertMigrationSafety(
  statements: string[],
  options: MigrationGuardOptions = {}
): MigrationSafetyReport {
  return assertMigrationSafetyDomain(statements, options);
}
