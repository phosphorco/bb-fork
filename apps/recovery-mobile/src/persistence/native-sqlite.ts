import {
  openDatabaseAsync,
  type SQLiteDatabase,
  type SQLiteVariadicBindParams,
} from "expo-sqlite";

import type {
  RecoverySqlDatabase,
  SqlBindValue,
  SqlRunResult,
} from "./contracts";

function nativeParams(params: readonly SqlBindValue[]): SQLiteVariadicBindParams {
  return [...params] as SQLiteVariadicBindParams;
}

class ExpoRecoverySqlDatabase implements RecoverySqlDatabase {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly ownsConnection: boolean,
  ) {}

  async exec(sql: string): Promise<void> {
    await this.database.execAsync(sql);
  }

  async run(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<SqlRunResult> {
    const result = await this.database.runAsync(sql, ...nativeParams(params));
    return {
      changes: result.changes,
      lastInsertRowId: result.lastInsertRowId,
    };
  }

  getFirst<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T | null> {
    return this.database.getFirstAsync<T>(sql, ...nativeParams(params));
  }

  getAll<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, ...nativeParams(params));
  }

  async transaction<T>(
    operation: (tx: RecoverySqlDatabase) => Promise<T>,
  ): Promise<T> {
    let result: T | undefined;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      result = await operation(new ExpoRecoverySqlDatabase(transaction, false));
    });
    return result as T;
  }

  async close(): Promise<void> {
    if (this.ownsConnection) await this.database.closeAsync();
  }
}

export async function openNativeRecoveryDatabase(
  name = "bb-recovery.db",
): Promise<RecoverySqlDatabase> {
  return new ExpoRecoverySqlDatabase(await openDatabaseAsync(name), true);
}
