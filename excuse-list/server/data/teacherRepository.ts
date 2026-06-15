import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Unit } from '../../data/unit';

export function getStudentsByClass(className: string) {
  const db = new Unit(true);
  const students = db.prepare(`
    SELECT untisId, firstName, lastName, className
    FROM Student
    WHERE className = ?
    ORDER BY lastName ASC, firstName ASC
  `).all(className);
  db.complete(null);
  return students;
}

export function getStudentSignedAbsences(studentId: string, className: string) {
  const db = new Unit(true);
  const student = db.prepare(`SELECT untisId FROM Student WHERE untisId = ? AND className = ?`).get(studentId, className) as any;
  if (!student) {
    db.complete(null);
    return null;
  }
  const absences = db.prepare(`
    SELECT id, date, startTime, endTime, status, excuseMessage
    FROM Absence
    WHERE studentUntisId = ? AND status = 'signed' AND isExcusedUntis = 0
    ORDER BY date DESC
  `).all(studentId);
  db.complete(null);
  return absences;
}

export function getStudentAllAbsences(
  studentId: string,
  className: string,
  range?: { min: number; max: number } | null,
) {
  const db = new Unit(true);
  const student = db.prepare(`SELECT untisId FROM Student WHERE untisId = ? AND className = ?`).get(studentId, className) as any;
  if (!student) {
    db.complete(null);
    return null;
  }
  const dateClause = range ? ` AND a.date BETWEEN ? AND ?` : '';
  const dateParams = range ? [range.min, range.max] : [];
  const absences = db.prepare(`
    SELECT a.id, a.date, a.startTime, a.endTime, a.status, a.excuseMessage,
           COUNT(att.id) AS attachmentCount
    FROM Absence a
    LEFT JOIN Attachment att ON att.absenceId = a.id
    WHERE a.studentUntisId = ? AND a.isExcusedUntis = 0${dateClause}
    GROUP BY a.id
    ORDER BY a.date DESC
  `).all(studentId, ...dateParams);
  db.complete(null);
  return absences;
}

export async function seedMockTeacher() {
  const db = new Unit(true);
  const existing = db.prepare(`SELECT id FROM Teacher WHERE username = ?`).get('prof3bhif') as any;
  db.complete(null);

  if (existing) return;

  const plainPassword = 'lehrer1234';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const writeDb = new Unit(false);
  try {
    writeDb.prepare(`
      INSERT INTO Teacher (id, username, passwordHash, name, className)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), 'prof3bhif', passwordHash, 'Prof. Maier', '3BHIF');
    writeDb.complete(true);
  } catch (err) {
    writeDb.complete(false);
    console.error('Failed to seed mock teacher:', err);
  }
}

export function getClassBehaviorSummary(className: string) {
  const db = new Unit(true);
  // Count from Absence table (populated on student login, always reliable).
  // Excused-in-WebUntis rows are deleted from Absence on sync, so every row
  // here is still outstanding. status='open' = no excuse submitted at all.
  const rows = db.prepare(`
    SELECT s.untisId, s.firstName, s.lastName,
           COUNT(DISTINCT a.id)                                               AS totalHours,
           COUNT(DISTINCT CASE WHEN al.absenceStatus = 'unexcused' THEN al.id END) AS notExcusedHours
    FROM Student s
    LEFT JOIN Absence a  ON a.studentUntisId  = s.untisId
    LEFT JOIN AbsenceLesson al ON al.studentUntisId = s.untisId AND al.absenceStatus = 'unexcused'
    WHERE s.className = ?
    GROUP BY s.untisId, s.firstName, s.lastName
    ORDER BY s.lastName ASC, s.firstName ASC
  `).all(className);
  db.complete(null);
  return rows;
}

export function getTeacherByClass(db: Unit, className: string) {
  return db.prepare(`SELECT id FROM Teacher WHERE className = ?`).get(className) as any;
}

export async function createTeacherForClass(db: Unit, className: string) {
  const username = `prof${className.toLowerCase()}`;
  const passwordHash = await bcrypt.hash('lehrer1234', 10);
  const name = `Prof. ${className}`;
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO Teacher (id, username, passwordHash, name, className)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, passwordHash, name, className);
}

