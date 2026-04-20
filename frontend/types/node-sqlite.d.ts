declare module 'node:sqlite' {
  export type SqliteValue = string | number | bigint | Uint8Array | null | undefined;

  export interface StatementSync {
    run(...values: SqliteValue[]): unknown;
    get(...values: SqliteValue[]): unknown;
    all(...values: SqliteValue[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
