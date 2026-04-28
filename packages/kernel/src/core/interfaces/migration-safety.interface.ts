export interface MigrationGuardOptions {
  allowDestructive?: boolean;
  destructiveStatementAllowlist?: string[];
}

export interface MigrationSafetyReport {
  destructiveStatements: string[];
  blockedStatements: string[];
}
