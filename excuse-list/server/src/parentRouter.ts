import { Router } from 'express';
import { Unit } from '../../data/unit';
import { verifyJwt } from '../middleware/auth';
import { requireParent } from '../middleware/roleGuard';
import { getParentPendingAbsences, getAllAbsencesByParent, getAbsenceByIdAndParent, signAbsence } from '../data/excuseRepository';

const router = Router();

function parseDateInt(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/-/g, '');
  return /^\d{8}$/.test(digits) ? Number(digits) : null;
}

function buildRange(from: unknown, to: unknown): { min: number; max: number } | null {
  const f = parseDateInt(from);
  const t = parseDateInt(to);
  if (f == null && t == null) return null;
  const lo = f ?? 0;
  const hi = t ?? 99999999;
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

router.get('/api/parent/absences', verifyJwt, requireParent, async (req, res) => {
  try {
    const range = buildRange(req.query.from, req.query.to);
    const absences = getAllAbsencesByParent(req.user!.parentId!, range);
    res.json(absences);
  } catch (error: any) {
    console.error('Error fetching parent absences:', error.message);
    res.status(500).json({ error: 'Error fetching parent absences' });
  }
});

router.get('/api/parent/excuses', verifyJwt, requireParent, async (req, res) => {
  try {
    const absences = getParentPendingAbsences(req.user!.parentId!);
    res.json(absences);
  } catch (error: any) {
    console.error('Error fetching parent excuses:', error.message);
    res.status(500).json({ error: 'Error fetching parent excuses' });
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
