import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

export function syncAbsences(db: Unit, absences: any[], personId: number): any[] {
  // ON CONFLICT: if WebUntis now says "nicht entschuldigt" (unexcused), stamp
  // that onto the row regardless of what the student/parent has done locally.
  // For all other incoming statuses ('open') preserve the local status so that
  // a student-submitted excuse ('pending'/'signed') is not overwritten.
  const stmt = db.prepare(`
    INSERT INTO Absence (id, untisId, studentUntisId, date, startTime, endTime, isExcusedUntis, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(untisId) DO UPDATE SET
      isExcusedUntis = 0,
      status = CASE WHEN excluded.status = 'unexcused' THEN 'unexcused' ELSE Absence.status END
  `);

  for (const a of absences) {
    const isExcused = a.isExcused === true;
    // Teacher explicitly marked "nicht entschuldigt" in WebUntis: excuseStatus
    // is set but isExcused is not true.
    const isUnexcused = !isExcused && !!a.excuseStatus;

    // DEBUG: log every absence so we can see what WebUntis sends for "nicht entschuldigt"
    console.log('[syncAbsences]', JSON.stringify({ id: a.id, date: a.startDate ?? a.date, isExcused: a.isExcused, excuseStatus: a.excuseStatus, reason: a.reason, text: a.text }));

    if (isExcused) {
      db.prepare(`DELETE FROM Absence WHERE untisId = ?`).run(a.id);
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

export function getAbsencesByStudent(untisId: number): any[] {
  const db = new Unit(true);
  const absences = db.prepare(`
    SELECT * FROM Absence
    WHERE studentUntisId = ?
    ORDER BY date DESC
  `).all(untisId);
  db.complete(null);
  return absences as any[];
}
