import { Router } from 'express';
import crypto from 'node:crypto';
import { Unit } from '../../data/unit';
import { verifyJwt } from '../middleware/auth';
import { requireStudent } from '../middleware/roleGuard';
import { getAbsencesByStudent, updateAbsenceToPending } from '../data/absenceRepository';
import { getStudentParent, } from '../data/parentRepository';
import { insertExcuse, insertAttachments } from '../data/excuseRepository';

const router = Router();

router.get('/api/absences', verifyJwt, async (req, res) => {
  try {
    console.log(`Fetching absences for user: ${req.user!.username}`);

    const absences = getAbsencesByStudent(req.user!.untisId!);
    console.log(`Fetched ${absences.length} total absences`);

    const unexcused = absences.filter((a) => a.status === 'open' && a.isExcusedUntis === 0);
    console.log(`Filtered to ${unexcused.length} unexcused absences`);

    res.json(unexcused);
  } catch (error: any) {
    console.error('Error fetching absences:', error.message);
    res.status(500).json({ error: 'Error fetching absences', details: error.message });
  }
});

router.post('/api/excuses/submit', verifyJwt, requireStudent, async (req, res) => {
  try {
    const { absenceId, message, attachments } = req.body;
    if (!absenceId) {
      return res.status(400).json({ error: 'absenceId fehlt' });
    }

    const db = new Unit(false);
    try {
      const studentParent = getStudentParent(db, req.user!.untisId!);

      if (!studentParent) {
        db.complete(false);
        return res.status(400).json({ error: 'Diesem Schüler ist kein Elternteil zugewiesen' });
      }

      const excuseId = crypto.randomUUID();

      insertExcuse(db, excuseId, absenceId, studentParent.parentId, message || null);

      if (attachments && Array.isArray(attachments)) {
        insertAttachments(db, excuseId, attachments);
      }

      updateAbsenceToPending(db, absenceId, req.user!.untisId!);

      db.complete(true);
      res.json({ success: true });
    } catch (err) {
      db.complete(false);
      throw err;
    }
  } catch (error: any) {
    console.error('Submit excuse error:', error.message);
    res.status(500).json({ error: 'Fehler beim Einreichen der Entschuldigung' });
  }
});

export default router;
