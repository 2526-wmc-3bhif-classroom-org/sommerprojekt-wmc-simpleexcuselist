import { Unit } from '../../data/unit';

export function upsertStudent(
  db: Unit,
  personId: number,
  firstName: string,
  lastName: string,
  className: string,
) {
  db.prepare(`
    INSERT INTO Student (untisId, firstName, lastName, className)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(untisId)
    DO UPDATE SET
      firstName = excluded.firstName,
      lastName = excluded.lastName,
      className = excluded.className
  `).run(personId, firstName, lastName, className);
}
