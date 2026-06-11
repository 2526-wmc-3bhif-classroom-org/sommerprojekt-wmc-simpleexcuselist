import { Router } from 'express';
import { verifyJwt } from '../middleware/auth';
import { requireTeacherOrParent } from '../middleware/roleGuard';
import {
  getAttachmentsByAbsence,
  absenceBelongsToParent,
  absenceInTeacherClass,
} from '../data/excuseRepository';

const router = Router();

router.get('/api/absences/:absenceId/attachments', verifyJwt, requireTeacherOrParent, async (req, res) => {
  try {
    const { absenceId } = req.params;

    // Ownership check: a parent may only read attachments for their own
    // child's absences; a teacher only for students in their class. Without
    // this, any authenticated parent/teacher could read any absence's medical
    // certificates by guessing/iterating the id.
    const role = req.user!.role;
    const allowed =
      role === 'parent'
        ? absenceBelongsToParent(absenceId, req.user!.parentId!)
        : absenceInTeacherClass(absenceId, req.user!.className!);

    if (!allowed) {
      return res.status(404).json({ error: 'Fehlstunde nicht gefunden' });
    }

    const attachments = getAttachmentsByAbsence(absenceId);
    res.json(attachments);
  } catch (error: any) {
    console.error('Error fetching attachments:', error.message);
    res.status(500).json({ error: 'Error fetching attachments', details: error.message });
  }
});

export default router;
