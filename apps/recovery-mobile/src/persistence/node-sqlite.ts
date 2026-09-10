import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type {
  RecoverySqlDatabase,
  SqlBindValue,
  SqlRunResult,
} from "./contracts";

function nodeParams(params: readonly SqlBindValue[]): SQLInputValue[] {
  return [...params] as SQLInputValue[];
}

/** Node-only adapter used by Vitest and command-line recovery witnesses. */
export class NodeRecoverySqlDatabase implements RecoverySqlDatabase {
  private operationTail: Promise<void> = Promise.resolve();

  constructor(private readonly database: DatabaseSync) {}

  static open(path: string): NodeRecoverySqlDatabase {
    return new NodeRecoverySqlDatabase(new DatabaseSync(path));
  }

  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const scheduled = this.operationTail.then(operation, operation);
    this.operationTail = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }

  exec(sql: string): Promise<void> {
    return this.enqueue(() => this.database.exec(sql));
  }

  async run(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<SqlRunResult> {
    return this.enqueue(() => {
      const result = this.database.prepare(sql).run(...nodeParams(params));
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    });
  }

  async getFirst<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T | null> {
    return this.enqueue(
      () =>
        (this.database.prepare(sql).get(...nodeParams(params)) as
          | T
          | undefined) ?? null,
    );
  }

  async getAll<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T[]> {
    return this.enqueue(
      () => this.database.prepare(sql).all(...nodeParams(params)) as T[],
    );
  }

  async transaction<T>(
    operation: (tx: RecoverySqlDatabase) => Promise<T>,
  ): Promise<T> {
    return this.enqueue(async () => {
      this.database.exec("BEGIN IMMEDIATE");
      const transaction = new NodeRecoverySqlTransaction(this.database);
      try {
        const result = await operation(transaction);
        this.database.exec("COMMIT");
        return result;
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.enqueue(() => this.database.close());
  }
}

/** Transaction-scoped view; nested work belongs to the same atomic unit. */
class NodeRecoverySqlTransaction implements RecoverySqlDatabase {
  constructor(private readonly database: DatabaseSync) {}

  async exec(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async run(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<SqlRunResult> {
    const result = this.database.prepare(sql).run(...nodeParams(params));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirst<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T | null> {
    return (
      (this.database.prepare(sql).get(...nodeParams(params)) as
        | T
        | undefined) ?? null
    );
  }

  async getAll<T>(
    sql: string,
    params: readonly SqlBindValue[] = [],
  ): Promise<T[]> {
    return this.database.prepare(sql).all(...nodeParams(params)) as T[];
  }

  transaction<T>(
    operation: (tx: RecoverySqlDatabase) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }

  async close(): Promise<void> {
    throw new Error("Cannot close a transaction-scoped Recovery database");
  }
}
