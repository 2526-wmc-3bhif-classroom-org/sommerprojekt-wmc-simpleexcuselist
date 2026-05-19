import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

export function syncAbsences(db: Unit, absences: any[], personId: number): any[] {
  const stmt = db.prepare(`
    INSERT INTO Absence (id, untisId, studentUntisId, date, startTime, endTime, isExcusedUntis, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
    ON CONFLICT(untisId) DO UPDATE SET
      isExcusedUntis = excluded.isExcusedUntis
  `);

  for (const a of absences) {
    const isExcused = (a.isExcused !== false || a.excuseStatus) ? 1 : 0;
    stmt.run(
      crypto.randomUUID(),
      a.id,
      personId,
      a.startDate || a.date,
      a.startTime || 0,
      a.endTime || 0,
      isExcused,
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

export function updateAbsenceToPending(db: Unit, absenceId: string, studentUntisId: number) {
  db.prepare(`
    UPDATE Absence
    SET status = 'pending'
    WHERE id = ? AND studentUntisId = ?
  `).run(absenceId, studentUntisId);
}
