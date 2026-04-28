export interface MigrationExecutionContext {
  appId: string;
  fromVersion: number;
  toVersion: number;
  requestId?: string;
}
