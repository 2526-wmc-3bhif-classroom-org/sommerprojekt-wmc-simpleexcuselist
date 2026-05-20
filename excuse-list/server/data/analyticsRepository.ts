import crypto from 'node:crypto';
import { Unit } from '../../data/unit';

interface NormalizedAbsence {
  date: number;
  startTime: number;
  endTime: number;
}

function normalizeAbsences(absences: any[]): NormalizedAbsence[] {
  return absences
    .map((a) => ({
      date: Number(a.startDate ?? a.date),
      startTime: Number(a.startTime ?? 0),
      endTime: Number(a.endTime ?? 0),
    }))
    .filter((a) => Number.isFinite(a.date) && a.date > 0);
}

function lessonOverlapsAbsence(lesson: any, abs: NormalizedAbsence): boolean {
  if (lesson.date !== abs.date) return false;
  // WebUntis times are HHMM integers, monotonic within a day, so numeric
  // comparison is a valid interval-overlap test.
  return lesson.startTime < abs.endTime && lesson.endTime > abs.startTime;
}

export function syncAbsenceLessons(
  db: Unit,
  studentUntisId: number,
  lessons: any[],
  absences: any[],
): number {
  const normAbsences = normalizeAbsences(absences);

  db.prepare(`DELETE FROM AbsenceLesson WHERE studentUntisId = ?`).run(studentUntisId);

  if (normAbsences.length === 0) return 0;

  const matched = lessons.filter((l) => {
    if (l.code === 'cancelled') return false;
    if (!l.su || l.su.length === 0) return false;
    return normAbsences.some((abs) => lessonOverlapsAbsence(l, abs));
  });

  const stmt = db.prepare(`
    INSERT INTO AbsenceLesson
      (id, studentUntisId, untisLessonId, date, startTime, endTime, subjectName, subjectLongName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const l of matched) {
    const su = l.su[0];
    stmt.run(
      crypto.randomUUID(),
      studentUntisId,
      l.id,
      l.date,
      l.startTime,
      l.endTime,
      su.name ?? 'UNBEKANNT',
      su.longname ?? '',
    );
  }

  return matched.length;
}

export function getSubjectAbsenceStats(studentUntisId: number, className: string) {
  const db = new Unit(true);
  const student = db
    .prepare(`SELECT untisId FROM Student WHERE untisId = ? AND className = ?`)
    .get(studentUntisId, className) as any;
  if (!student) {
    db.complete(null);
    return null;
  }
  const rows = db
    .prepare(`
      SELECT subjectName,
             MAX(subjectLongName) AS subjectLongName,
             COUNT(*) AS missedLessons
      FROM AbsenceLesson
      WHERE studentUntisId = ?
      GROUP BY subjectName
      ORDER BY missedLessons DESC, subjectName ASC
    `)
    .all(studentUntisId);
  db.complete(null);
  return rows;
}
