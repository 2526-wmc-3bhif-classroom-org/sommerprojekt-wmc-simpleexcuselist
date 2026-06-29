import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

// Upload limits for excuse attachments (medical certificates). Attachments
// arrive as data URLs (data:<mime>;base64,<data>) in the JSON body.
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per file
const ALLOWED_ATTACHMENT_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

// Validates an attachments array against the count/size/type limits. Returns a
// German error message if invalid, or null if everything is acceptable. This is
// the authoritative check — the client does the same for UX but can be bypassed.
export function validateAttachments(attachments: unknown[]): string | null {
  if (attachments.length > MAX_ATTACHMENTS) {
    return `Maximal ${MAX_ATTACHMENTS} Dateien erlaubt.`;
  }

  for (const att of attachments as any[]) {
    if (!att || typeof att.fileName !== 'string' || typeof att.fileData !== 'string') {
      return 'Ungültiger Dateianhang.';
    }

    // Parse the data URL header: "data:<mime>;base64,<data>".
    const commaIndex = att.fileData.indexOf(',');
    const header = commaIndex === -1 ? '' : att.fileData.slice(0, commaIndex);
    const base64 = commaIndex === -1 ? '' : att.fileData.slice(commaIndex + 1);
    if (!header.startsWith('data:') || !/;base64$/i.test(header)) {
      return 'Dateianhang muss base64-kodiert sein.';
    }

    const mime = header.slice('data:'.length).split(';')[0].toLowerCase();
    if (!ALLOWED_ATTACHMENT_MIME.has(mime)) {
      return 'Nur PDF, JPEG und PNG sind erlaubt.';
    }

    // Decoded byte length is the real file size (base64 inflates by ~33%).
    const sizeBytes = Buffer.from(base64, 'base64').length;
    if (sizeBytes === 0) {
      return 'Leerer Dateianhang.';
    }
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      return 'Jede Datei darf höchstens 5 MB groß sein.';
    }
  }

  return null;
}

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

export function getAllAbsencesByParent(
  parentId: string,
  range?: { min: number; max: number } | null,
): any[] {
  const db = new Unit(true);
  const dateClause = range ? ` AND a.date BETWEEN ? AND ?` : '';
  const dateParams: (string | number)[] = range ? [parentId, range.min, range.max] : [parentId];
  const absences = db.prepare(`
    SELECT
      a.id,
      a.date,
      a.startTime,
      a.endTime,
      a.status,
      a.isExcusedUntis,
      a.excuseMessage,
      s.firstName as studentFirstName,
      s.lastName as studentLastName
    FROM Absence a
    JOIN StudentParent sp ON sp.studentUntisId = a.studentUntisId
    JOIN Student s ON s.untisId = a.studentUntisId
    WHERE sp.parentId = ?${dateClause}
    ORDER BY a.date DESC
  `).all(...dateParams);
  db.complete(null);
  return absences as any[];
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
