import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

export function updateAbsenceWithExcuse(
  db: Unit,
  absenceId: string,
  parentId: string,
  message: string | null,
) {
  db.prepare(`
    UPDATE Absence
    SET excuseParentId = ?, excuseMessage = ?, status = 'pending', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(parentId, message, absenceId);
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
