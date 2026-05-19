import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

export function insertExcuse(
  db: Unit,
  excuseId: string,
  absenceId: string,
  parentId: string,
  message: string | null,
) {
  db.prepare(`
    INSERT INTO Excuse (id, absenceId, parentId, message, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(excuseId, absenceId, parentId, message);
}

export function insertAttachments(db: Unit, excuseId: string, attachments: any[]) {
  const stmt = db.prepare(`
    INSERT INTO Attachment (id, excuseId, fileName, fileData)
    VALUES (?, ?, ?, ?)
  `);
  for (const att of attachments) {
    if (att.fileName && att.fileData) {
      stmt.run(crypto.randomUUID(), excuseId, att.fileName, att.fileData);
    }
  }
}

export function getParentPendingExcuses(parentId: string) {
  const db = new Unit(true);
  const excuses = db.prepare(`
    SELECT
      e.id as excuseId,
      e.status as excuseStatus,
      a.id as absenceId,
      a.date,
      a.startTime,
      a.endTime,
      e.message as excuseMessage,
      s.firstName as studentFirstName,
      s.lastName as studentLastName
    FROM Excuse e
    JOIN Absence a ON e.absenceId = a.id
    JOIN Student s ON a.studentUntisId = s.untisId
    WHERE e.parentId = ? AND e.status = 'pending'
    ORDER BY a.date DESC
  `).all(parentId);
  db.complete(null);
  return excuses;
}

export function getExcuseByIdAndParent(db: Unit, excuseId: string, parentId: string) {
  return db.prepare(`SELECT absenceId FROM Excuse WHERE id = ? AND parentId = ?`).get(excuseId, parentId) as any;
}

export function signExcuse(db: Unit, excuseId: string, absenceId: string) {
  db.prepare(`UPDATE Excuse SET status = 'signed' WHERE id = ?`).run(excuseId);
  db.prepare(`UPDATE Absence SET status = 'signed' WHERE id = ?`).run(absenceId);
}

export function getAttachmentsByExcuse(excuseId: string) {
  const db = new Unit(true);
  const attachments = db.prepare(`SELECT fileName, fileData FROM Attachment WHERE excuseId = ?`).all(excuseId);
  db.complete(null);
  return attachments;
}
