import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

// Scoped by studentUntisId so a student can only excuse their OWN absences.
// Returns the number of rows changed (0 means the absence does not exist or
// does not belong to this student).
export function updateAbsenceWithExcuse(
  db: Unit,
  absenceId: string,
  studentUntisId: number,
  parentId: string,
  message: string | null,
): number {
  const result = db.prepare(`
    UPDATE Absence
    SET excuseParentId = ?, excuseMessage = ?, status = 'pending', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND studentUntisId = ?
  `).run(parentId, message, absenceId, studentUntisId);
  return result.changes;
}

export function insertAttachments(db: Unit, absenceId: string, attachments: any[]) {
  const stmt = db.prepare(`
    INSERT INTO Attachment (id, absenceId, fileName, fileData)
    VALUES (?, ?, ?, ?)
  `);
  for (const att of attachments) {
    if (att.fileName && att.fileData) {
      stmt.run(crypto.randomUUID(), absenceId, att.fileName, att.fileData);
    }
  }
}

export function getParentPendingAbsences(parentId: string) {
  const db = new Unit(true);
  const absences = db.prepare(`
    SELECT
      a.id as absenceId,
      a.status as excuseStatus,
      a.date,
      a.startTime,
      a.endTime,
      a.excuseMessage,
      s.firstName as studentFirstName,
      s.lastName as studentLastName
    FROM Absence a
    JOIN Student s ON a.studentUntisId = s.untisId
    WHERE a.excuseParentId = ? AND a.status = 'pending'
    ORDER BY a.date DESC
  `).all(parentId);
  db.complete(null);
  return absences;
}

export function getAbsenceByIdAndParent(db: Unit, absenceId: string, parentId: string) {
  return db.prepare(`SELECT id FROM Absence WHERE id = ? AND excuseParentId = ?`).get(absenceId, parentId) as any;
}

export function signAbsence(db: Unit, absenceId: string) {
  db.prepare(`UPDATE Absence SET status = 'signed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(absenceId);
}

export function getAttachmentsByAbsence(absenceId: string) {
  const db = new Unit(true);
  const attachments = db.prepare(`SELECT fileName, fileData FROM Attachment WHERE absenceId = ?`).all(absenceId);
  db.complete(null);
  return attachments;
}

// True if the absence belongs to one of this parent's children (via
// StudentParent). Used to gate access to attachments (medical certificates).
export function absenceBelongsToParent(absenceId: string, parentId: string): boolean {
  const db = new Unit(true);
  const row = db.prepare(`
    SELECT 1
    FROM Absence a
    JOIN StudentParent sp ON sp.studentUntisId = a.studentUntisId
    WHERE a.id = ? AND sp.parentId = ?
  `).get(absenceId, parentId);
  db.complete(null);
  return !!row;
}

// True if the absence belongs to a student in this teacher's class.
export function absenceInTeacherClass(absenceId: string, className: string): boolean {
  const db = new Unit(true);
  const row = db.prepare(`
    SELECT 1
    FROM Absence a
    JOIN Student s ON s.untisId = a.studentUntisId
    WHERE a.id = ? AND s.className = ?
  `).get(absenceId, className);
  db.complete(null);
  return !!row;
}
