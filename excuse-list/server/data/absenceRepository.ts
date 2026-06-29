import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

export function syncAbsences(db: Unit, absences: any[], personId: number): any[] {
  // ON CONFLICT for open/unexcused rows: stamp 'unexcused' when WebUntis says
  // "nicht entschuldigt"; otherwise preserve local status (pending/signed).
  const stmt = db.prepare(`
    INSERT INTO Absence (id, untisId, studentUntisId, date, startTime, endTime, isExcusedUntis, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(untisId) DO UPDATE SET
      isExcusedUntis = 0,
      status = CASE WHEN excluded.status = 'unexcused' THEN 'unexcused' ELSE Absence.status END
  `);

  // Kept separate so "entschuldigt" always wins and overwrites any local status.
  const excusedStmt = db.prepare(`
    INSERT INTO Absence (id, untisId, studentUntisId, date, startTime, endTime, isExcusedUntis, status)
    VALUES (?, ?, ?, ?, ?, ?, 1, 'excused')
    ON CONFLICT(untisId) DO UPDATE SET
      isExcusedUntis = 1,
      status = 'excused'
  `);

  for (const a of absences) {
    const isExcused = a.isExcused === true;
    const isUnexcused = !isExcused && !!a.excuseStatus;

    if (isExcused) {
      excusedStmt.run(
        crypto.randomUUID(),
        a.id,
        personId,
        a.startDate || a.date,
        a.startTime || 0,
        a.endTime || 0,
      );
      continue;
    }

    stmt.run(
      crypto.randomUUID(),
      a.id,
      personId,
      a.startDate || a.date,
      a.startTime || 0,
      a.endTime || 0,
      isUnexcused ? 'unexcused' : 'open',
    );
  }
  return absences;
}

export function getAbsencesByStudent(
  untisId: number,
  range?: { min: number; max: number } | null,
): any[] {
  const db = new Unit(true);
  const dateClause = range ? ` AND date BETWEEN ? AND ?` : '';
  const dateParams = range ? [range.min, range.max] : [];
  const absences = db.prepare(`
    SELECT * FROM Absence
    WHERE studentUntisId = ?${dateClause}
    ORDER BY date DESC
  `).all(untisId, ...dateParams);
  db.complete(null);
  return absences as any[];
}
