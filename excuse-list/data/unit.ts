import BetterSqlite3 from "better-sqlite3";
import type {Database} from "better-sqlite3";

const dbFileName = "excuselist.db";

export class Unit {

  private readonly db: Database;
  private completed: boolean;

  public constructor(public readonly readOnly: boolean) {
    this.completed = false;
    this.db = DB.createDBConnection();
    if (!this.readOnly) {
      DB.beginTransaction(this.db);
    }
  }

  public prepare<TResult, TParams extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    bindings?: TParams
  ): ITypedStatement<TResult, TParams> {
    const stmt = this.db.prepare<unknown[], TResult>(sql);
    if (bindings != null) {
      stmt.bind(bindings as unknown);
    }
    return stmt as unknown as ITypedStatement<TResult, TParams>;
  }

  public getLastRowId(): number {
    const stmt = this.prepare<{ id: number }>("SELECT last_insert_rowid() as \"id\"");
    const result = stmt.get();
    if (!result) {
      throw new Error("Unable to retrieve last inserted row id");
    }
    return result.id;
  }

  public complete(commit: boolean | null = null): void {
    if (this.completed) {
      return;
    }
    this.completed = true;

    if (commit !== null) {
      (commit ? DB.commitTransaction(this.db) : DB.rollbackTransaction(this.db));
    } else if (!this.readOnly) {
      throw new Error("transaction has been opened, requires information if commit or rollback needed");
    }
    this.db.close();
  }
}

export function ensureSampleDataInserted(unit: Unit): "inserted" | "skipped" {
  function alreadyPresent(): boolean {
    return true;
  }

  function insert(): void {
    // Planes
  }

  if (!(alreadyPresent())) {
    insert();
    return "inserted";
  }
  return "skipped";
}

export class DB {
  public static createDBConnection(): Database {
    const db = new BetterSqlite3(dbFileName, {
      fileMustExist: false,
      verbose: (s: unknown) => DB.logStatement(s)
    });
    db.pragma("foreign_keys = ON");

    DB.ensureTablesCreated(db);

    return db;
  }

  public static beginTransaction(connection: Database): void {
    connection.exec("begin transaction;");
  }

  public static commitTransaction(connection: Database): void {
    connection.exec("commit;");
  }

  public static rollbackTransaction(connection: Database): void {
    connection.exec("rollback;");
  }

  private static logStatement(statement: string | unknown): void {
    if (typeof statement !== "string") {
      return;
    }
    const start = statement.slice(0, 6).trim().toLowerCase();
    // Avoid using startsWith for compatibility with older TS lib settings
    if (start.indexOf("pragma") === 0 || start.indexOf("create") === 0) {
      return;
    }
    console.log(`SQL: ${statement}`);
  }

  private static ensureTablesCreated(connection: Database): void {
    connection.exec(`
      CREATE TABLE IF NOT EXISTS Teacher
      (
        id        TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName  TEXT NOT NULL,
        CONSTRAINT PK_teacher PRIMARY KEY (id)
      );

      CREATE TABLE IF NOT EXISTS Class
      (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        classTeacherId TEXT,

        CONSTRAINT FK_classTeacherId
          FOREIGN KEY (classTeacherId)
            REFERENCES Teacher(id)
      );

      CREATE TABLE IF NOT EXISTS Student
      (
        id        TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName  TEXT NOT NULL,
        classId   INTEGER NOT NULL,
        guardianId Text NOT NULL,

        CONSTRAINT PK_student PRIMARY KEY (id),
        CONSTRAINT FK_class
          FOREIGN KEY (classId)
            REFERENCES Class(id),
        Constraint FK_guardian FOREIGN KEY (guardianId) references Guardian(id)
      );
        CREATE TABLE IF NOT EXISTS Guardian
        (
          id Text PRIMARY KEY,
          firstName TEXT NOT NULL,
          lastName  TEXT NOT NULL,
          CONSTRAINT PK_student PRIMARY KEY (id)
        )
    `);
  }
}

type RawStatement<TResult> = BetterSqlite3.Statement<any[], TResult>;
type RunResult = ReturnType<RawStatement<unknown>["run"]>;

export interface ITypedStatement<TResult = unknown, TParams = unknown> {
  // phantom type, just carries the params type for tooling
  readonly _params?: TParams;

  get(): TResult | undefined;

  all(): TResult[];

  // accept variadic args to match BetterSqlite3.Statement.run signature
  run(...args: any[]): RunResult;
}
