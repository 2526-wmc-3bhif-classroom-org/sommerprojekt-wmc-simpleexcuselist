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
  const rows = db.prepare(`
    SELECT s.untisId, s.firstName, s.lastName,
           COUNT(al.id) AS totalHours,
           COUNT(CASE WHEN al.absenceStatus IN ('open', 'pending') THEN 1 END) AS unexcusedHours
    FROM Student s
    LEFT JOIN AbsenceLesson al ON al.studentUntisId = s.untisId
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

