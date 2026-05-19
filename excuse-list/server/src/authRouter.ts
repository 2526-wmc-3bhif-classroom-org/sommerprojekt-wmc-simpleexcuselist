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
} from '../data/untisService';
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
        return { token, role: 'student', absences };
      } catch (err) {
        db.complete(false);
        throw err;
      }
    });

    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;
