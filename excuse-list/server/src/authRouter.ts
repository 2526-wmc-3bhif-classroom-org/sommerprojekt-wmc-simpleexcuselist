import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { Unit } from '../../data/unit';
import { jwtSecret } from '../middleware/auth';
import {
  withUntis,
  fetchUserDetails,
  fetchUserClassAndNamesFallback,
  fetchRandomFirstName,
  fetchTimetableForRange,
} from '../data/untisService';
import {
  syncAbsenceLessons,
  syncClassScheduledLessons,
  getClassLastSynced,
  setClassLastSynced,
} from '../data/analyticsRepository';
import { upsertStudent } from '../data/studentRepository';
import {
  getTeacherByUsername,
  getParentByUsername,
  studentHasParent,
  getStudentParent,
  generateUniqueParentId,
  createParentAccount,
} from '../data/parentRepository';
import { syncAbsences } from '../data/absenceRepository';

const router = Router();

const SCHOOL_YEAR_START = 20250901; // YYYYMMDD
const SYNC_OVERLAP_DAYS = 7; // re-fetch the last week so recent changes self-heal

function untisIntToDate(d: number): Date {
  const s = String(d);
  return new Date(
    Number(s.slice(0, 4)),
    Number(s.slice(4, 6)) - 1,
    Number(s.slice(6, 8)),
  );
}

function dateToUntisInt(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// Keeps the shared class timetable fresh and rematches this student's absences
// against it. The class timetable is backfilled once (first login of the class)
// and every later login only tops up the last week — so a normal login costs
// ~1–2 WebUntis calls, not a full-year fetch. Runs after the login response is
// sent so it never adds latency to the (already slow) login.
async function syncStudentTimetableInBackground(
  username: string,
  password: string,
  personId: number,
  className: string,
  untisAbsences: any[],
): Promise<void> {
  try {
    const todayInt = dateToUntisInt(new Date());

    // Resume from the class watermark (minus an overlap window); backfill the
    // whole year only when the class has never been synced.
    let lastSynced: number | null;
    {
      const rdb = new Unit(true);
      lastSynced = getClassLastSynced(rdb, className);
      rdb.complete(null);
    }

    let fetchStartInt = SCHOOL_YEAR_START;
    if (lastSynced != null) {
      const overlap = untisIntToDate(lastSynced);
      overlap.setDate(overlap.getDate() - SYNC_OVERLAP_DAYS);
      fetchStartInt = Math.max(SCHOOL_YEAR_START, dateToUntisInt(overlap));
    }

    const lessons = await withUntis(username, password, (untis) =>
      fetchTimetableForRange(untis, untisIntToDate(fetchStartInt), new Date()),
    );

    const db = new Unit(false);
    try {
      const scheduled = syncClassScheduledLessons(db, className, lessons, fetchStartInt);
      setClassLastSynced(db, className, todayInt);
      const matched = syncAbsenceLessons(db, personId, className, untisAbsences);
      db.complete(true);
      console.log(
        `Timetable sync ${className}/${personId}: fetched from ${fetchStartInt}, ` +
          `${lessons.length} lessons, ${scheduled} stored, ${matched} matched to absences.`,
      );
    } catch (err) {
      db.complete(false);
      throw err;
    }
  } catch (err) {
    console.warn('Background timetable sync failed:', err);
  }
}

router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const teacher = getTeacherByUsername(username);
    if (teacher) {
      const isMatch = await bcrypt.compare(password, teacher.passwordHash);
      if (isMatch) {
        const token = jwt.sign(
          { teacherId: teacher.id, username: teacher.username, role: 'teacher', className: teacher.className },
          jwtSecret,
          { expiresIn: '1h' },
        );
        return res.json({ token, role: 'teacher' });
      } else {
        return res.status(401).json({ error: 'Invalid teacher credentials' });
      }
    }

    const parent = getParentByUsername(username);
    if (parent) {
      const isMatch = await bcrypt.compare(password, parent.passwordHash);
      if (isMatch) {
        const token = jwt.sign(
          { parentId: parent.id, username: parent.username, role: 'parent' },
          jwtSecret,
          { expiresIn: '1h' },
        );
        return res.json({ token, role: 'parent' });
      } else {
        return res.status(401).json({ error: 'Invalid parent credentials' });
      }
    }

    let bgSync: { personId: number; className: string; untisAbsences: any[] } | null = null;

    const result = await withUntis(username, password, async (untis) => {
      const session = untis.sessionInformation;
      const personId = session.personId;
      const personType = session.personType;

      const initialDetails = await fetchUserDetails(untis, personType, personId, username);
      const { className, firstName, lastName } = await fetchUserClassAndNamesFallback(
        untis,
        personId,
        initialDetails.firstName,
        initialDetails.lastName,
        username,
      );

      let untisAbsences: any[] = [];
      try {
        const startDate = new Date('2025-09-01');
        const endDate = new Date();
        const result = await untis.getAbsentLesson(startDate, endDate);
        untisAbsences = Array.isArray(result) ? result : (result?.absences || []);
      } catch (e) {
        console.warn('Could not fetch absences:', e);
      }

      const existingParentFlag = studentHasParent(personId);

      let randomFirstName = '';
      if (!existingParentFlag) {
        randomFirstName = await fetchRandomFirstName();
      }

      const db = new Unit(false);
      let absences: any[] = [];
      try {
        upsertStudent(db, personId, firstName, lastName, className);

        if (!existingParentFlag) {
          const parentId = generateUniqueParentId(db);
          const plainPassword = crypto.randomBytes(5).toString('hex');
          const passwordHash = await bcrypt.hash(plainPassword, 10);
          const parentName = `${randomFirstName} ${lastName}`;

          createParentAccount(db, parentId, passwordHash, parentName, personId);

          console.log(`\n==============================================`);
          console.log(`New Parent Account Created for Student: ${firstName} ${lastName}`);
          console.log(`Username / ID: ${parentId}`);
          console.log(`Password: ${plainPassword}`);
          console.log(`==============================================\n`);
        }

        absences = syncAbsences(db, untisAbsences, personId);

        const token = jwt.sign(
          { untisId: personId, username, role: 'student' },
          jwtSecret,
          { expiresIn: '1h' },
        );

        db.complete(true);
        bgSync = { personId, className, untisAbsences };
        return { token, role: 'student', absences };
      } catch (err) {
        db.complete(false);
        throw err;
      }
    });

    res.json(result);

    if (bgSync) {
      const { personId, className, untisAbsences } = bgSync;
      void syncStudentTimetableInBackground(username, password, personId, className, untisAbsences);
    }
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;
