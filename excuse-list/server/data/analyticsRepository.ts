import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

// ─── Time blocks ────────────────────────────────────────────────────────────

const LESSON_PERIODS: { period: number; start: number; end: number }[] = [
  { period: 0,  start:  705, end:  755 },
  { period: 1,  start:  800, end:  850 },
  { period: 2,  start:  855, end:  945 },
  { period: 3,  start: 1000, end: 1050 },
  { period: 4,  start: 1055, end: 1145 },
  { period: 5,  start: 1150, end: 1240 },
  { period: 6,  start: 1245, end: 1335 },
  { period: 7,  start: 1340, end: 1430 },
  { period: 8,  start: 1435, end: 1525 },
  { period: 9,  start: 1530, end: 1620 },
  { period: 10, start: 1625, end: 1715 },
  { period: 11, start: 1720, end: 1805 },
  { period: 12, start: 1805, end: 1850 },
  { period: 13, start: 1900, end: 1945 },
  { period: 14, start: 1945, end: 2030 },
  { period: 15, start: 2040, end: 2125 },
  { period: 16, start: 2125, end: 2210 },
];

// Returns all period indices that overlap with a given [startTime, endTime] window (HHMM integers)
function getOverlappingPeriods(startTime: number, endTime: number): number[] {
  return LESSON_PERIODS
    .filter((p) => startTime < p.end && endTime > p.start)
    .map((p) => p.period);
}

// WebUntis date integer (YYYYMMDD) → 0=Mon … 4=Fri, or -1 if weekend
function dateToDayOfWeek(dateInt: number): number {
  const s = dateInt.toString();
  const d = new Date(
    parseInt(s.slice(0, 4)),
    parseInt(s.slice(4, 6)) - 1,
    parseInt(s.slice(6, 8)),
  );
  const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  return day >= 1 && day <= 5 ? day - 1 : -1;
}

// ─── Absence normalization ───────────────────────────────────────────────────

interface NormalizedAbsence {
  date: number;
  startTime: number;
  endTime: number;
  absenceStatus: string;
  subject?: string;
}

// Maps WebUntis absence fields to a status string for AbsenceLesson.
// 'unexcused' = teacher explicitly marked "nicht entschuldigt" (excuseStatus set, not excused).
function resolveAbsenceStatus(a: any): string {
  if (a.isExcused === true) return 'excused';
  if (a.excuseStatus) return 'unexcused';
  return 'open';
}

function normalizeAbsences(absences: any[]): NormalizedAbsence[] {
  return absences
    .map((a) => ({
      date: Number(a.startDate ?? a.date),
      startTime: Number(a.startTime ?? 0),
      endTime: Number(a.endTime ?? 0),
      absenceStatus: resolveAbsenceStatus(a),
      subject: a.subject,
    }))
    .filter((a) => Number.isFinite(a.date) && a.date > 0);
}

function lessonOverlapsAbsence(lesson: any, abs: NormalizedAbsence): boolean {
  if (lesson.date !== abs.date) return false;
  return lesson.startTime < abs.endTime && lesson.endTime > abs.startTime;
}

// ─── Sync: scheduled lessons (per student) ──────────────────────────────

// Replaces the student timetable from windowStartInt onward with the freshly
// fetched lessons, leaving older rows intact.
export function syncStudentScheduledLessons(
  db: Unit,
  studentUntisId: number,
  lessons: any[],
  windowStartInt: number,
): number {
  db.prepare(`DELETE FROM StudentScheduledLesson WHERE studentUntisId = ? AND date >= ?`).run(
    studentUntisId,
    windowStartInt,
  );

  const stmt = db.prepare(`
    INSERT INTO StudentScheduledLesson
      (id, studentUntisId, date, startTime, endTime, subjectName, subjectLongName)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const l of lessons) {
    if (l.code === 'cancelled') continue;
    if (!l.su || l.su.length === 0) continue;
    if (l.date < windowStartInt) continue; // stay within the window we just cleared
    const su = l.su[0];
    stmt.run(
      crypto.randomUUID(),
      studentUntisId,
      l.date,
      l.startTime,
      l.endTime,
      su.name ?? 'UNBEKANNT',
      su.longname ?? '',
    );
    count++;
  }
  return count;
}

// Watermark: the last date (YYYYMMDD) up to which the student timetable is synced.
export function getStudentLastSynced(db: Unit, studentUntisId: number): number | null {
  const row = db
    .prepare(`SELECT lastSynced FROM StudentSyncState WHERE studentUntisId = ?`)
    .get(studentUntisId) as any;
  return row ? row.lastSynced : null;
}

export function setStudentLastSynced(db: Unit, studentUntisId: number, dateInt: number): void {
  db.prepare(`
    INSERT INTO StudentSyncState (studentUntisId, lastSynced)
    VALUES (?, ?)
    ON CONFLICT(studentUntisId) DO UPDATE SET lastSynced = excluded.lastSynced
  `).run(studentUntisId, dateInt);
}

// ─── Sync: absence lessons (per student) ─────────────────────────────────────

// Matches this student's absences against the student's own timetable already in
// the DB (StudentScheduledLesson). Must run after syncStudentScheduledLessons so the
// table covers the absence dates.
export function syncAbsenceLessons(
  db: Unit,
  studentUntisId: number,
  className: string,
  absences: any[],
): number {
  const normAbsences = normalizeAbsences(absences); // all statuses

  db.prepare(`DELETE FROM AbsenceLesson WHERE studentUntisId = ?`).run(studentUntisId);

  if (normAbsences.length === 0) return 0;

  // Pull only the student's lessons on the (sparse) absence dates, then match by
  // time overlap in JS.
  const dates = [...new Set(normAbsences.map((a) => a.date))];
  const placeholders = dates.map(() => '?').join(',');
  const studentLessons = db
    .prepare(`
      SELECT date, startTime, endTime, subjectName, subjectLongName
      FROM StudentScheduledLesson
      WHERE studentUntisId = ? AND date IN (${placeholders})
    `)
    .all(studentUntisId, ...dates) as any[];

  const stmt = db.prepare(`
    INSERT INTO AbsenceLesson
      (id, studentUntisId, untisLessonId, date, startTime, endTime, subjectName, subjectLongName, absenceStatus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const l of studentLessons) {
    const abs = normAbsences.find((a) => {
      const timeOverlap = lessonOverlapsAbsence(l, a);
      if (!timeOverlap) return false;
      if (a.subject && a.subject.toUpperCase() !== l.subjectName.toUpperCase()) return false;
      return true;
    });
    if (!abs) continue;
    stmt.run(
      crypto.randomUUID(),
      studentUntisId,
      0,
      l.date,
      l.startTime,
      l.endTime,
      l.subjectName,
      l.subjectLongName ?? '',
      abs.absenceStatus,
    );
    count++;
  }

  return count;
}

// ─── Analytics queries ───────────────────────────────────────────────────────

export type AnalyticsMode = 'open' | 'all';

// AbsenceLesson.absenceStatus is derived from WebUntis at sync time and is only
// ever 'open' or 'excused' (a locally-pending excuse is still 'open' here — see
// resolveAbsenceStatus). 'pending' is kept in the filter for forward-compat in
// case local excuse state ever gets synced onto lessons. 'open' mode therefore
// means "everything still open in WebUntis", matching the spec (Q1).
function statusFilter(mode: AnalyticsMode): string {
  return mode === 'open'
    ? `AND al.absenceStatus IN ('open', 'pending', 'unexcused')`
    : '';
}

export interface SubjectStat {
  subjectName: string;
  subjectLongName: string;
  missedLessons: number;
  totalLessons: number | null;
  percentage: number | null;
}

export interface HeatmapCell {
  dayOfWeek: number;   // 0=Mon … 4=Fri
  period: number;      // 0–16
  count: number;
  subjects?: string[];
}

export interface DateWindow {
  min: number;
  max: number;
}

// Optional user-supplied date window (YYYYMMDD) applied to AbsenceLesson rows.
// Returns the SQL fragment + bound params, or empty values when no range is set.
function dateRangeClause(range: DateWindow | null, col = 'al.date'): { sql: string; params: number[] } {
  return range
    ? { sql: ` AND ${col} BETWEEN ? AND ?`, params: [range.min, range.max] }
    : { sql: '', params: [] };
}

interface MissedRow {
  subjectName: string;
  subjectLongName: string;
  missedLessons: number;
}

// ── Date windows ──────────────────────────────────────────────────────────────
// In 'open' mode the denominator is the lessons scheduled between the earliest
// and latest still-open absence (spec Q3). In 'all' mode there is no window —
// every synced lesson counts (full school year up to today).

function studentOpenWindow(db: Unit, studentUntisId: number): DateWindow | null {
  const row = db
    .prepare(
      `SELECT MIN(date) AS min, MAX(date) AS max FROM AbsenceLesson
       WHERE studentUntisId = ? AND absenceStatus IN ('open', 'pending', 'unexcused')`,
    )
    .get(studentUntisId) as any;
  return row && row.min != null ? { min: row.min, max: row.max } : null;
}

function classOpenWindow(db: Unit, className: string): DateWindow | null {
  const row = db
    .prepare(
      `SELECT MIN(al.date) AS min, MAX(al.date) AS max FROM AbsenceLesson al
       JOIN Student s ON al.studentUntisId = s.untisId
       WHERE s.className = ? AND al.absenceStatus IN ('open', 'pending', 'unexcused')`,
    )
    .get(className) as any;
  return row && row.min != null ? { min: row.min, max: row.max } : null;
}

// ── Scheduled-lesson totals (the percentage denominator) ───────────────────────

// How many lessons of each subject the student's timetable holds,
// optionally restricted to a date window.
function studentScheduledCounts(
  db: Unit,
  studentUntisId: number,
  window: DateWindow | null,
): Map<string, number> {
  const rows = (
    window
      ? db
          .prepare(
            `SELECT subjectName, COUNT(*) AS c FROM StudentScheduledLesson
             WHERE studentUntisId = ? AND date BETWEEN ? AND ? GROUP BY subjectName`,
          )
          .all(studentUntisId, window.min, window.max)
      : db
          .prepare(
            `SELECT subjectName, COUNT(*) AS c FROM StudentScheduledLesson
             WHERE studentUntisId = ? GROUP BY subjectName`,
          )
          .all(studentUntisId)
  ) as any[];
  return new Map(rows.map((r) => [r.subjectName, r.c]));
}

// How many lessons of each subject all students in the class hold,
// optionally restricted to a date window.
function classScheduledCounts(
  db: Unit,
  className: string,
  window: DateWindow | null,
): Map<string, number> {
  const rows = (
    window
      ? db
          .prepare(
            `SELECT ssl.subjectName, COUNT(*) AS c 
             FROM StudentScheduledLesson ssl
             JOIN Student s ON ssl.studentUntisId = s.untisId
             WHERE s.className = ? AND ssl.date BETWEEN ? AND ? 
             GROUP BY ssl.subjectName`,
          )
          .all(className, window.min, window.max)
      : db
          .prepare(
            `SELECT ssl.subjectName, COUNT(*) AS c 
             FROM StudentScheduledLesson ssl
             JOIN Student s ON ssl.studentUntisId = s.untisId
             WHERE s.className = ? 
             GROUP BY ssl.subjectName`,
          )
          .all(className)
  ) as any[];
  return new Map(rows.map((r) => [r.subjectName, r.c]));
}

function countClassStudents(db: Unit, className: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM Student WHERE className = ?`).get(className) as any;
  return row?.c ?? 0;
}

// Merges missed-lesson counts with the scheduled-lesson denominator into the
// public SubjectStat shape, ordered by most-missed. `factor` scales the shared
// per-student total up to the whole class (1 for a single student). Percentage
// is clamped to 100.
function buildSubjectStats(
  missed: MissedRow[],
  totals: Map<string, number>,
  factor = 1,
): SubjectStat[] {
  return missed
    .map((r) => {
      const base = totals.get(r.subjectName);
      const total = base != null ? base * factor : null;
      return {
        subjectName: r.subjectName,
        subjectLongName: r.subjectLongName,
        missedLessons: r.missedLessons,
        totalLessons: total,
        percentage: total ? Math.min(100, Math.round((r.missedLessons / total) * 100)) : null,
      };
    })
    .sort((a, b) => b.missedLessons - a.missedLessons || a.subjectName.localeCompare(b.subjectName));
}

function studentSubjectStats(
  db: Unit,
  studentUntisId: number,
  className: string,
  mode: AnalyticsMode,
  range: DateWindow | null = null,
): SubjectStat[] {
  const dr = dateRangeClause(range);
  const missed = db
    .prepare(
      `SELECT al.subjectName,
              MAX(al.subjectLongName) AS subjectLongName,
              COUNT(*) AS missedLessons
       FROM AbsenceLesson al
       WHERE al.studentUntisId = ? ${statusFilter(mode)}${dr.sql}
       GROUP BY al.subjectName`,
    )
    .all(studentUntisId, ...dr.params) as MissedRow[];

  const window = range ?? (mode === 'open' ? studentOpenWindow(db, studentUntisId) : null);
  return buildSubjectStats(missed, studentScheduledCounts(db, studentUntisId, window));
}

export function getStudentAbsenceSummary(
  studentUntisId: number,
  className: string,
  range: DateWindow | null = null,
): { totalHours: number; unexcusedHours: number; notExcusedHours: number } | null {
  const db = new Unit(true);
  const student = db.prepare(`SELECT untisId FROM Student WHERE untisId = ? AND className = ?`)
    .get(studentUntisId, className) as any;
  if (!student) { db.complete(null); return null; }

  const dr = dateRangeClause(range);
  const totalRow = db.prepare(
    `SELECT COUNT(*) AS count FROM AbsenceLesson WHERE studentUntisId = ?${dr.sql}`,
  ).get(studentUntisId, ...dr.params) as any;
  const unexcusedRow = db.prepare(
    `SELECT COUNT(*) AS count FROM AbsenceLesson WHERE studentUntisId = ? AND absenceStatus IN ('open', 'pending')${dr.sql}`,
  ).get(studentUntisId, ...dr.params) as any;
  const notExcusedRow = db.prepare(
    `SELECT COUNT(*) AS count FROM AbsenceLesson WHERE studentUntisId = ? AND absenceStatus = 'unexcused'${dr.sql}`,
  ).get(studentUntisId, ...dr.params) as any;

  db.complete(null);
  return {
    totalHours: totalRow?.count ?? 0,
    unexcusedHours: unexcusedRow?.count ?? 0,
    notExcusedHours: notExcusedRow?.count ?? 0,
  };
}

export function getSubjectAbsenceStats(
  studentUntisId: number,
  className: string,
  mode: AnalyticsMode = 'open',
  range: DateWindow | null = null,
): SubjectStat[] | null {
  const db = new Unit(true);

  const student = db
    .prepare(`SELECT untisId FROM Student WHERE untisId = ? AND className = ?`)
    .get(studentUntisId, className) as any;

  if (!student) {
    db.complete(null);
    return null;
  }

  const stats = studentSubjectStats(db, studentUntisId, className, mode, range);
  db.complete(null);
  return stats;
}

export function getStudentHeatmapData(
  studentUntisId: number,
  className: string,
  mode: AnalyticsMode = 'open',
  range: DateWindow | null = null,
): HeatmapCell[] {
  const db = new Unit(true);

  const dr = dateRangeClause(range);
  const rows = db
    .prepare(`
      SELECT al.date, al.startTime, al.endTime, al.subjectName
      FROM AbsenceLesson al
      WHERE al.studentUntisId = ? ${statusFilter(mode)}${dr.sql}
    `)
    .all(studentUntisId, ...dr.params) as any[];

  db.complete(null);
  return buildHeatmap(rows);
}

export function getClassAbsenceStats(
  className: string,
  mode: AnalyticsMode = 'open',
  range: DateWindow | null = null,
): SubjectStat[] {
  const db = new Unit(true);

  const dr = dateRangeClause(range);
  const missed = db
    .prepare(`
      SELECT al.subjectName,
             MAX(al.subjectLongName) AS subjectLongName,
             COUNT(*) AS missedLessons
      FROM AbsenceLesson al
      JOIN Student s ON al.studentUntisId = s.untisId
      WHERE s.className = ? ${statusFilter(mode)}${dr.sql}
      GROUP BY al.subjectName
    `)
    .all(className, ...dr.params) as MissedRow[];

  // missed is summed across every student in the class, and classScheduledCounts
  // now returns the sum of all scheduled lessons for all students in the class,
  // so no scaling is needed (factor is 1).
  const window = range ?? (mode === 'open' ? classOpenWindow(db, className) : null);
  const stats = buildSubjectStats(missed, classScheduledCounts(db, className, window), 1);
  db.complete(null);
  return stats;
}

export function getClassHeatmapData(
  className: string,
  mode: AnalyticsMode = 'open',
  range: DateWindow | null = null,
): HeatmapCell[] {
  const db = new Unit(true);

  const dr = dateRangeClause(range);
  const rows = db
    .prepare(`
      SELECT al.date, al.startTime, al.endTime, al.subjectName
      FROM AbsenceLesson al
      JOIN Student s ON al.studentUntisId = s.untisId
      WHERE s.className = ? ${statusFilter(mode)}${dr.sql}
    `)
    .all(className, ...dr.params) as any[];

  db.complete(null);
  return buildHeatmap(rows);
}

export interface StudentTopSubjects {
  untisId: number;
  firstName: string;
  lastName: string;
  top3: SubjectStat[];
}

export function getClassStudentTable(
  className: string,
  mode: AnalyticsMode = 'open',
  range: DateWindow | null = null,
): StudentTopSubjects[] {
  const db = new Unit(true);

  const students = db
    .prepare(`SELECT untisId, firstName, lastName FROM Student WHERE className = ? ORDER BY lastName, firstName`)
    .all(className) as any[];

  const result = students.map((s) => ({
    untisId: s.untisId,
    firstName: s.firstName,
    lastName: s.lastName,
    // Each student's own open window, so percentages match the single-student view.
    top3: studentSubjectStats(db, s.untisId, className, mode, range).slice(0, 3),
  }));

  db.complete(null);
  return result;
}

// ─── Heatmap builder ─────────────────────────────────────────────────────────

function buildHeatmap(rows: { date: number; startTime: number; endTime: number; subjectName?: string }[]): HeatmapCell[] {
  const map = new Map<string, { count: number; subjects: Set<string> }>();

  for (const row of rows) {
    const day = dateToDayOfWeek(row.date);
    if (day === -1) continue;
    const periods = getOverlappingPeriods(row.startTime, row.endTime);
    for (const period of periods) {
      const key = `${day}-${period}`;
      const existing = map.get(key) ?? { count: 0, subjects: new Set<string>() };
      existing.count += 1;
      if (row.subjectName) {
        existing.subjects.add(row.subjectName);
      }
      map.set(key, existing);
    }
  }

  const cells: HeatmapCell[] = [];
  for (const [key, val] of map) {
    const [d, p] = key.split('-').map(Number);
    cells.push({
      dayOfWeek: d!,
      period: p!,
      count: val.count,
      subjects: Array.from(val.subjects),
    });
  }
  return cells;
}


