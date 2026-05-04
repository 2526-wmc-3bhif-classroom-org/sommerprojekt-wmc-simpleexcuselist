import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebUntis } from 'webuntis';
import crypto from 'node:crypto';
import {Unit} from "../data/unit";

export interface Parent {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  createdAt?: string;
}

export async function fetchRandomFirstName(): Promise<string> {
  const res = await fetch('https://randomuser.me/api/?inc=name');
  const data = await res.json();
  return data.results[0].name.first;
}

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const school = process.env.UNTIS_SCHOOL || 'htl-leonding';
const untisHost = process.env.UNTIS_BASE_URL || 'htl-leonding.webuntis.com';
const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-1234';

async function withUntis<T>(
  username: string,
  password: string,
  fn: (untis: WebUntis) => Promise<T>,
): Promise<T> {
  const untis = new WebUntis(school, username, password, untisHost, 'excuse-list');
  await untis.login();
  try {
    return await fn(untis);
  } finally {
    try {
      await untis.logout();
    } catch {}
  }
}

app.use(cors());
app.use(express.json());

async function fetchUserDetails(untis: WebUntis, personType: number, personId: number, username: string) {
  let firstName = username;
  let lastName = '';
  try {
    if (personType === 5) {
      const students = await untis.getStudents();
      const me = students.find((s: any) => s.id === personId);
      if (me) {
        firstName = me.foreName || firstName;
        lastName = me.longName || lastName;
      }
    } else if (personType === 2) {
      const teachers = await untis.getTeachers();
      const me = teachers.find((t: any) => t.id === personId);
      if (me) {
        firstName = me.foreName || firstName;
        lastName = me.longName || lastName;
      }
    }
  } catch (err) {
    console.warn('Could not fetch user master data:', err);
  }
  return { firstName, lastName };
}

async function fetchUserClassAndNamesFallback(untis: WebUntis, personId: number, currentFirstName: string, currentLastName: string, username: string) {
  let className = 'UNKNOWN';
  let firstName = currentFirstName;
  let lastName = currentLastName;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const timetable = await untis.getOwnTimetableForRange(start, end);

  for (const lesson of timetable) {
    if (lesson.kl && lesson.kl.length > 0) {
      className = lesson.kl[0].name;
    }

    const me =
      lesson.st?.find((s: any) => s.id === personId) ||
      lesson.te?.find((t: any) => t.id === personId);

    if (me) {
      if (firstName === username && me.foreName) firstName = me.foreName;
      if (!lastName && me.longName) lastName = me.longName;
    }

    if (className !== 'UNKNOWN' && lastName !== '') {
      break;
    }
  }
  return { className, firstName, lastName };
}

function upsertStudent(db: Unit, personId: number, firstName: string, lastName: string, className: string) {
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

async function ensureParentAccount(db: Unit, personId: number, firstName: string, lastName: string) {
  const existingParent = db.prepare(`SELECT * FROM StudentParent WHERE studentUntisId = ?`).get(personId);
  if (!existingParent) {
    let parentId = '';
    let isUnique = false;
    while (!isUnique) {
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      parentId = `gu${randomDigits}`;
      const checkId = db.prepare(`SELECT id FROM Parent WHERE id = ?`).get(parentId);
      if (!checkId) isUnique = true;
    }

    const plainPassword = crypto.randomBytes(5).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');

    const randomFirstName = await fetchRandomFirstName();
    const parentName = `${randomFirstName} ${lastName}`;

    db.prepare(`
      INSERT INTO Parent (id, username, passwordHash, name)
      VALUES (?, ?, ?, ?)
    `).run(parentId, parentId, passwordHash, parentName);

    db.prepare(`
      INSERT INTO StudentParent (parentId, studentUntisId)
      VALUES (?, ?)
    `).run(parentId, personId);

    console.log(`\n==============================================`);
    console.log(`New Parent Account Created for Student: ${firstName} ${lastName}`);
    console.log(`Username / ID: ${parentId}`);
    console.log(`Password: ${plainPassword}`);
    console.log(`==============================================\n`);
  }
}

async function syncAndGetAbsences(db: Unit, untis: WebUntis, personId: number) {
  const startDate = new Date('2025-09-01');
  const endDate = new Date();

  let absences: any[] = [];
  try {
    const result = await untis.getAbsentLesson(startDate, endDate);
    absences = Array.isArray(result) ? result : (result?.absences || []);
  } catch (e) {
    console.warn('Could not fetch absences:', e);
  }

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
      isExcused
    );
  }
  return absences;
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await withUntis(username, password, async (untis) => {

      // 1. get session (only gives ID)
      const session = untis.sessionInformation;
      const personId = session.personId;
      const personType = session.personType; // 5 = Student, 2 = Teacher

      // Fetch user details
      const initialDetails = await fetchUserDetails(untis, personType, personId, username);
      const { className, firstName, lastName } = await fetchUserClassAndNamesFallback(
        untis, personId, initialDetails.firstName, initialDetails.lastName, username
      );

      const db = new Unit(false);
      let absences: any[] = [];
      try {
        upsertStudent(db, personId, firstName, lastName, className);
        await ensureParentAccount(db, personId, firstName, lastName);
        absences = await syncAndGetAbsences(db, untis, personId);

        // JWT
        const token = jwt.sign(
          { untisId: personId, username, role: "student" },
          jwtSecret,
          { expiresIn: '1h' }
        );

        db.complete(true); // Commit the transaction
        return { token, absences };

      } catch (err) {
        db.complete(false); // Rollback on error
        throw err;
      }
    });

    res.json(result);

  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/absences', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    console.log(`Fetching absences for user: ${decoded.username}`);

    const db = new Unit(true); // Read-only

    // Fetch absences from database
    const absences = db.prepare(`
      SELECT * FROM Absence
      WHERE studentUntisId = ?
      ORDER BY date DESC
    `).all(decoded.untisId);

    console.log(`Fetched ${absences.length} total absences`);

    // Filter to unexcused only
    const unexcused = (absences as any[]).filter((a) => a.status === 'open' && a.isExcusedUntis === 0);
    console.log(`Filtered to ${unexcused.length} unexcused absences`);

    db.complete(null); // Close the database connection
    res.json(unexcused);
  } catch (error: any) {
    console.error('Error fetching absences:', error.message);
    res.status(500).json({ error: 'Error fetching absences', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
