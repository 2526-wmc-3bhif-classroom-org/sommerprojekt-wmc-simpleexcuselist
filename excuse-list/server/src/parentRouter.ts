import { Router } from 'express';
import { Unit } from '../../data/unit';
import { verifyJwt } from '../middleware/auth';
import { requireParent } from '../middleware/roleGuard';
import { getParentPendingExcuses, getExcuseByIdAndParent, signExcuse } from '../data/excuseRepository';

const router = Router();

router.get('/api/parent/excuses', verifyJwt, requireParent, async (req, res) => {
  try {
    const excuses = getParentPendingExcuses(req.user!.parentId!);
    res.json(excuses);
  } catch (error: any) {
    console.error('Error fetching parent excuses:', error.message);
    res.status(500).json({ error: 'Error fetching parent excuses', details: error.message });
  }
});

router.post('/api/parent/excuses/:excuseId/sign', verifyJwt, requireParent, async (req, res) => {
  try {
    const { excuseId } = req.params;
    const db = new Unit(false);

    try {
      const excuse = getExcuseByIdAndParent(db, excuseId, req.user!.parentId!);
      if (!excuse) {
        db.complete(false);
        return res.status(404).json({ error: 'Excuse not found or not owned by this parent' });
      }

      signExcuse(db, excuseId, excuse.absenceId);

      db.complete(true);
      res.json({ success: true });
    } catch (err) {
      db.complete(false);
      throw err;
    }
  } catch (error: any) {
    console.error('Error signing excuse:', error.message);
    res.status(500).json({ error: 'Error signing excuse' });
  }
});

export default router;
