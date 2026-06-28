import { Router } from 'express';
import { Unit } from '../../data/unit';
import { verifyJwt } from '../middleware/auth';
import { requireStudent } from '../middleware/roleGuard';
import { getAbsencesByStudent } from '../data/absenceRepository';
import { getStudentParent, } from '../data/parentRepository';
import { updateAbsenceWithExcuse, insertAttachments, validateAttachments } from '../data/excuseRepository';
import { getSubjectAbsenceStats, getStudentHeatmapData, getStudentAbsenceSummary, AnalyticsMode } from '../data/analyticsRepository';


const router = Router();

router.get('/api/absences', verifyJwt, async (req, res) => {
  try {
    console.log(`Fetching absences for user: ${req.user!.username}`);

    const studentId = req.user!.untisId!;
    const absences = getAbsencesByStudent(studentId);
    console.log(`Fetched ${absences.length} total absences`);

    // The actionable "Meine Fehlstunden" view shows absences the student can
    // still do something about: 'open' (no excuse yet) and 'unexcused' (teacher
    // refused — the student may resubmit). In-flight ones ('pending'/'signed')
    // stay hidden until they resolve. The client buckets these into the
    // "Offen" / "Nicht entschuldigt" tabs by status.
    const actionable = absences.filter(
      (a) => a.status === 'open' || a.status === 'unexcused',
    );
    console.log(`Filtered to ${actionable.length} actionable absences`);

    // The stat cards count lesson-hours (Einheiten) from AbsenceLesson — the
    // full record that also keeps already-excused lessons, which the Absence
    // table drops on sync. "Nicht entschuldigt" = everything not excused
    // (open/pending + teacher-marked unexcused).
    const db = new Unit(true);
    const student = db.prepare(`SELECT className FROM Student WHERE untisId = ?`).get(studentId) as any;
    db.complete(null);
    const summary = student
      ? getStudentAbsenceSummary(studentId, student.className)
      : null;
    const totalCount = summary?.totalHours ?? 0;
    const missedDays = summary?.missedDays ?? 0;
    const openCount = summary?.openHours ?? 0;
    const excusedCount = summary?.excusedHours ?? 0;
    const unexcusedCount = (summary?.notExcusedHours ?? 0);

    res.json({ absences: actionable, totalCount, missedDays, openCount, excusedCount, unexcusedCount });
  } catch (error: any) {
    console.error('Error fetching absences:', error.message);
    res.status(500).json({ error: 'Error fetching absences' });
  }
});

router.post('/api/excuses/submit', verifyJwt, requireStudent, async (req, res) => {
  try {
    const { absenceId, message, attachments } = req.body;
    if (!absenceId) {
      return res.status(400).json({ error: 'absenceId fehlt' });
    }

    if (attachments != null) {
      if (!Array.isArray(attachments)) {
        return res.status(400).json({ error: 'Ungültige Dateianhänge' });
      }
      const attachmentError = validateAttachments(attachments);
      if (attachmentError) {
        return res.status(400).json({ error: attachmentError });
      }
    }

    const db = new Unit(false);
    try {
      const studentParent = getStudentParent(db, req.user!.untisId!);

      if (!studentParent) {
        db.complete(false);
        return res.status(400).json({ error: 'Diesem Schüler ist kein Elternteil zugewiesen' });
      }

      const changed = updateAbsenceWithExcuse(
        db,
        absenceId,
        req.user!.untisId!,
        studentParent.parentId,
        message || null,
      );

      // Zero rows means the absence is not this student's (or doesn't exist).
      // Reject instead of silently attaching files to it.
      if (changed === 0) {
        db.complete(false);
        return res.status(404).json({ error: 'Fehlstunde nicht gefunden' });
      }

      if (attachments && Array.isArray(attachments)) {
        insertAttachments(db, absenceId, attachments);
      }

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

router.get('/api/student/analytics', verifyJwt, requireStudent, async (req, res) => {
  try {
    const mode: AnalyticsMode = req.query.mode === 'all' ? 'all' : 'open';
    const studentId = req.user!.untisId!;

    const db = new Unit(true);
    const student = db.prepare(`SELECT className FROM Student WHERE untisId = ?`).get(studentId) as any;
    db.complete(null);

    if (!student) {
      return res.status(404).json({ error: 'Student nicht gefunden' });
    }

    const stats = getSubjectAbsenceStats(studentId, student.className, mode);
    const heatmap = getStudentHeatmapData(studentId, student.className, mode);
    res.json({ stats, heatmap });
  } catch (error: any) {
    console.error('Error fetching student analytics:', error.message);
    res.status(500).json({ error: 'Fehler beim Laden der Analyse' });
  }
});


export default router;
