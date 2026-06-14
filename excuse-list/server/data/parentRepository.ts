import { Unit } from '../../data/unit';

export function getTeacherByUsername(username: string) {
  const db = new Unit(true);
  const teacher = db.prepare(`SELECT * FROM Teacher WHERE username = ?`).get(username);
  db.complete(null);
  return teacher as any;
}

export function getParentByUsername(username: string) {
  const db = new Unit(true);
  const parent = db.prepare(`SELECT * FROM Parent WHERE username = ?`).get(username);
  db.complete(null);
  return parent as any;
}

export function studentHasParent(studentUntisId: number): boolean {
  const db = new Unit(true);
  const result = db.prepare(`SELECT parentId FROM StudentParent WHERE studentUntisId = ?`).get(studentUntisId);
  db.complete(null);
  return !!result;
}

export function getStudentParent(db: Unit, studentUntisId: number) {
  return db.prepare(`SELECT parentId FROM StudentParent WHERE studentUntisId = ?`).get(studentUntisId) as any;
}

export function generateUniqueParentId(db: Unit): string {
  let parentId = '';
  let isUnique = false;
  while (!isUnique) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    parentId = `gu${randomDigits}`;
    const checkId = db.prepare(`SELECT id FROM Parent WHERE id = ?`).get(parentId);
    if (!checkId) isUnique = true;
  }
  return parentId;
}

export function createParentAccount(
  db: Unit,
  parentId: string,
  passwordHash: string,
  parentName: string,
  studentUntisId: number,
  plainPassword: string,
) {
  db.prepare(`
    INSERT INTO Parent (id, username, passwordHash, name, plainPassword)
    VALUES (?, ?, ?, ?, ?)
  `).run(parentId, parentId, passwordHash, parentName, plainPassword);

  db.prepare(`
    INSERT INTO StudentParent (parentId, studentUntisId)
    VALUES (?, ?)
  `).run(parentId, studentUntisId);
}
