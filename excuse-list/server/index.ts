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

      // 2. fetch timetable (for name + class)
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);

      const timetable = await untis.getOwnTimetableForRange(start, end);

      let firstName = username;
      let lastName = "";
      let className = "UNKNOWN";

      for (const lesson of timetable) {

        // extract class
        if (lesson.kl && lesson.kl.length > 0) {
          className = lesson.kl[0].name;
        }

        // extract name (student or teacher)
        const me =
          lesson.st?.find(s => s.id === personId) ||
          lesson.te?.find(t => t.id === personId);

        if (me) {
          firstName = me.foreName || firstName;
          lastName = me.longName || lastName;
        }

        if (className !== "UNKNOWN" && firstName !== username) {
          break;
        }
      }
      const db = new Unit(false);
      try {
        // 3. UPSERT student
        db.prepare(`
        INSERT INTO Student (untisId, firstName, lastName, className)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(untisId)
        DO UPDATE SET
          firstName = excluded.firstName,
          lastName = excluded.lastName,
          className = excluded.className
      `).run(
        personId,
        firstName,
        lastName,
        className
      );


       // 4. fetch absences
       const startDate = new Date('2025-09-01');
       const endDate = new Date();

       let absences: any[] = [];
       try {
         const result = await untis.getAbsentLesson(startDate, endDate);
         absences = Array.isArray(result) ? result : (result?.absences || []);
       } catch (e) {
         console.warn('Could not fetch absences:', e);
       }

       // 5. store absences
       const stmt = db.prepare(`
         INSERT INTO Absence (id, untisId, studentUntisId, date, startTime, endTime, status)
         VALUES (?, ?, ?, ?, ?, ?, 'open')
         ON CONFLICT(untisId) DO NOTHING
       `);

       for (const a of absences) {
         stmt.run(
           crypto.randomUUID(),
           a.id,
           personId,
           a.startDate || a.date,
           a.startTime || 0,
           a.endTime || 0
         );
       }

       // 6. JWT (FIXED — no password!)
       const token = jwt.sign(
         {
           untisId: personId,
           username,
           role: "student"
         },
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
    const unexcused = (absences as any[]).filter((a) => a.status === 'open');
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
