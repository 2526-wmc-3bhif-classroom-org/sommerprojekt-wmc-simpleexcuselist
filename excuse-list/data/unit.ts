import { createRequire } from "node:module";
import type { Database } from "better-sqlite3";

const require = createRequire(import.meta.url);
const BetterSqlite3 = require("better-sqlite3") as new (
  fileName: string,
  options?: {
    fileMustExist?: boolean;
    verbose?: (s: unknown) => void;
  }
) => Database;

const dbFileName = "excuselist.db";

export class Unit {
  private readonly db: Database;
  private completed: boolean;
  // Hier die Eigenschaft explizit deklarieren für Node.js Kompatibilität
  public readonly readOnly: boolean;

  public constructor(readOnly: boolean) {
    this.readOnly = readOnly; // Wert manuell zuweisen
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
    const studentColumns = DB.getTableColumns(connection, "Student");
    const absenceColumns = DB.getTableColumns(connection, "Absence");

    const hasLegacyStudentSchema = studentColumns.includes("classId") || studentColumns.includes("guardianId") || studentColumns.includes("password");
    const hasLegacyAbsenceSchema = absenceColumns.includes("studentId") || absenceColumns.includes("excused");

    if (hasLegacyStudentSchema || hasLegacyAbsenceSchema) {
      DB.rebuildDatabase(connection);
      return;
    }

    DB.createCurrentSchema(connection);
  }

  private static rebuildDatabase(connection: Database): void {
    connection.pragma("foreign_keys = OFF");
    connection.exec(`
      DROP TABLE IF EXISTS Attachment;
      DROP TABLE IF EXISTS Excuse;
      DROP TABLE IF EXISTS StudentParent;
      DROP TABLE IF EXISTS ClassTeacher;
      DROP TABLE IF EXISTS Absence;
      DROP TABLE IF EXISTS Parent;
      DROP TABLE IF EXISTS Student;
      DROP TABLE IF EXISTS Teacher;
      DROP TABLE IF EXISTS Class;
      DROP TABLE IF EXISTS Guardian;
    `);
    connection.pragma("foreign_keys = ON");

    DB.createCurrentSchema(connection);
  }

  private static createCurrentSchema(connection: Database): void {
    connection.exec(`
      CREATE TABLE IF NOT EXISTS Student
      (
        untisId   INTEGER PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName  TEXT NOT NULL,
        className TEXT NOT NULL,
        lastSync  TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Parent
      (
        id           TEXT PRIMARY KEY,
        username     TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        name         TEXT NOT NULL,
        createdAt    TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS StudentParent
      (
        parentId       TEXT NOT NULL,
        studentUntisId INTEGER NOT NULL,

        PRIMARY KEY (parentId, studentUntisId),

        FOREIGN KEY (parentId) REFERENCES Parent(id) ON DELETE CASCADE,
        FOREIGN KEY (studentUntisId) REFERENCES Student(untisId) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Absence
      (
        id             TEXT PRIMARY KEY,
        untisId        INTEGER NOT NULL UNIQUE,
        studentUntisId INTEGER NOT NULL,
        date           INTEGER NOT NULL,
        startTime      INTEGER NOT NULL,
        endTime        INTEGER NOT NULL,
        isExcusedUntis INTEGER DEFAULT 0,
        status         TEXT NOT NULL DEFAULT 'open',
        createdAt      TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt      TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (studentUntisId) REFERENCES Student(untisId) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Excuse
      (
        id        TEXT PRIMARY KEY,
        absenceId TEXT NOT NULL,
        parentId  TEXT NOT NULL,
        message   TEXT,
        status    TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (absenceId) REFERENCES Absence(id) ON DELETE CASCADE,
        FOREIGN KEY (parentId) REFERENCES Parent(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Attachment
      (
        id        TEXT PRIMARY KEY,
        excuseId  TEXT NOT NULL,
        fileName  TEXT NOT NULL,
        fileData  TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (excuseId) REFERENCES Excuse(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Teacher
      (
        id           TEXT PRIMARY KEY,
        username     TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        name         TEXT NOT NULL,
        className    TEXT NOT NULL,
        createdAt    TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ClassTeacher
      (
        className      TEXT PRIMARY KEY,
        teacherUntisId INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_student_class ON Student(className);
      CREATE INDEX IF NOT EXISTS idx_absence_student ON Absence(studentUntisId);
      CREATE INDEX IF NOT EXISTS idx_absence_status ON Absence(status);
      CREATE INDEX IF NOT EXISTS idx_excuse_absence ON Excuse(absenceId);
      CREATE INDEX IF NOT EXISTS idx_studentparent_parent ON StudentParent(parentId);
    `);
  }

  private static getTableColumns(connection: Database, tableName: string): string[] {
    const safeTableName = tableName.replace(/"/g, '""');
    const rows = connection.prepare(`PRAGMA table_info("${safeTableName}")`).all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  private static addStudent(){

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

