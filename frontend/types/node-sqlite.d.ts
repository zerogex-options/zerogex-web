// Hand-written typings for node:sqlite.
//
// WHY THESE EXIST. The app RUNS on Node 22, where node:sqlite ships
// DatabaseSync; it is TYPED against @types/node 20, which has no node:sqlite at
// all. Until those line up, this shim is the contract — which makes it load
// bearing in an unusual way: anything it leaves out is not "untyped", it is a
// compile error at every call site that uses it, and anything it overstates is a
// runtime crash the compiler blessed.
//
// It was previously missing the options argument and close(), both of which the
// runtime has had since Node 22.5. Every script that opened a database read-only
// or closed it therefore failed to compile — invisibly, because tsconfig.json
// did not include .mts and the scripts were never checked at all.
//
// Keep this to what the runtime actually provides. If you add a member, check it
// against `node -e "const {DatabaseSync} = require('node:sqlite'); ..."` on the
// deployed Node version first.
declare module 'node:sqlite' {
  export type SqliteValue = string | number | bigint | Uint8Array | null | undefined;

  export interface StatementSync {
    run(...values: SqliteValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    // `unknown` on purpose, NOT `any`. A row is whatever the SQL selected, and
    // the call site is the only place that knows its shape — so every caller
    // states it (`.all() as Array<{ id: string }>`), which is what makes a
    // column rename a compile error instead of an undefined at runtime.
    get(...values: SqliteValue[]): unknown;
    all(...values: SqliteValue[]): unknown[];
  }

  export interface DatabaseSyncOptions {
    /** Open the database read-only. Writes then throw rather than silently applying. */
    readOnly?: boolean;
    /** Open on construction (default true). */
    open?: boolean;
    enableForeignKeyConstraints?: boolean;
    enableDoubleQuotedStringLiterals?: boolean;
    allowExtension?: boolean;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    /** Release the file handle. Safe to call once; a second call throws. */
    close(): void;
  }
}
