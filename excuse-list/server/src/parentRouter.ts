import { Router } from 'express';
import { Unit } from '../../data/unit';
import { verifyJwt } from '../middleware/auth';
import { requireParent } from '../middleware/roleGuard';
import { getParentPendingAbsences, getAbsenceByIdAndParent, signAbsence } from '../data/excuseRepository';

const router = Router();

router.get('/api/parent/excuses', verifyJwt, requireParent, async (req, res) => {
  try {
    const absences = getParentPendingAbsences(req.user!.parentId!);
    res.json(absences);
  } catch (error: any) {
    console.error('Error fetching parent excuses:', error.message);
    res.status(500).json({ error: 'Error fetching parent excuses', details: error.message });
  }
});

router.post('/api/parent/absences/:absenceId/sign', verifyJwt, requireParent, async (req, res) => {
  try {
    const { absenceId } = req.params;
    const db = new Unit(false);

    try {
      const absence = getAbsenceByIdAndParent(db, absenceId, req.user!.parentId!);
      if (!absence) {
        db.complete(false);
        return res.status(404).json({ error: 'Absence not found or not owned by this parent' });
      }

      signAbsence(db, absenceId);

      db.complete(true);
      res.json({ success: true });
    } catch (err) {
      db.complete(false);
      throw err;
    }
  } catch (error: any) {
    console.error('Error signing absence:', error.message);
    res.status(500).json({ error: 'Error signing absence' });
  }
});

export default router;
