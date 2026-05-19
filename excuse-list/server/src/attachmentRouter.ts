import { Router } from 'express';
import { verifyJwt } from '../middleware/auth';
import { requireTeacherOrParent } from '../middleware/roleGuard';
import { getAttachmentsByAbsence } from '../data/excuseRepository';

const router = Router();

router.get('/api/absences/:absenceId/attachments', verifyJwt, requireTeacherOrParent, async (req, res) => {
  try {
    const { absenceId } = req.params;
    const attachments = getAttachmentsByAbsence(absenceId);
    res.json(attachments);
  } catch (error: any) {
    console.error('Error fetching attachments:', error.message);
    res.status(500).json({ error: 'Error fetching attachments', details: error.message });
  }
});

export default router;
