import { Router } from 'express';
import { Unit } from '../../data/unit';
import { verifyJwt } from '../middleware/auth';
import { requireTeacher } from '../middleware/roleGuard';
import { getStudentsByClass, getStudentSignedAbsences, getClassBehaviorSummary } from '../data/teacherRepository';

import {
  getSubjectAbsenceStats,
  getStudentHeatmapData,
  getClassAbsenceStats,
  getClassHeatmapData,
  getClassStudentTable,
  type AnalyticsMode,
  type DateWindow,
} from '../data/analyticsRepository';

const router = Router();

// Parses a YYYYMMDD or YYYY-MM-DD query value into a WebUntis date integer, or null.
function parseDateInt(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/-/g, '');
  return /^\d{8}$/.test(digits) ? Number(digits) : null;
}

// Builds an inclusive date window from optional from/to query params. Either side
// may be omitted (open-ended); order is normalised. Null when neither is given.
function buildRange(from: unknown, to: unknown): DateWindow | null {
  const f = parseDateInt(from);
  const t = parseDateInt(to);
  if (f == null && t == null) return null;
  const lo = f ?? 0;
  const hi = t ?? 99999999;
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

router.get('/api/teacher/students', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const students = getStudentsByClass(req.user!.className!);
    res.json(students);
  } catch (error: any) {
    console.error('Error fetching teacher students:', error.message);
    res.status(500).json({ error: 'Error fetching students' });
  }
});

router.get('/api/teacher/students/:studentId/absences', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const { studentId } = req.params;
    const studentIdNum = Number(studentId);
    const absences = getStudentSignedAbsences(studentId, req.user!.className!);

    if (absences === null) {
      return res.status(404).json({ error: 'Student not found in your class' });
    }

    const db = new Unit(true);
    const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM AbsenceLesson WHERE studentUntisId = ?`).get(studentIdNum) as any;
    const unexcusedRow = db.prepare(`SELECT COUNT(*) AS count FROM AbsenceLesson WHERE studentUntisId = ? AND absenceStatus IN ('open', 'pending')`).get(studentIdNum) as any;
    db.complete(null);

    res.json({
      absences,
      totalHours: totalRow?.count ?? 0,
      unexcusedHours: unexcusedRow?.count ?? 0
    });
  } catch (error: any) {
    console.error('Error fetching student absences:', error.message);
    res.status(500).json({ error: 'Error fetching absences' });
  }
});

router.get('/api/teacher/students/:studentId/analytics', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const mode: AnalyticsMode = req.query.mode === 'all' ? 'all' : 'open';
    const studentId = Number(req.params.studentId);
    const className = req.user!.className!;
    const range = buildRange(req.query.from, req.query.to);

    const stats = getSubjectAbsenceStats(studentId, className, mode, range);
    if (stats === null) {
      return res.status(404).json({ error: 'Student not found in your class' });
    }

    const heatmap = getStudentHeatmapData(studentId, className, mode, range);
    res.json({ stats, heatmap });
  } catch (error: any) {
    console.error('Error fetching student analytics:', error.message);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
});

router.get('/api/teacher/class/behavior', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const data = getClassBehaviorSummary(req.user!.className!);
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching behavior summary:', error.message);
    res.status(500).json({ error: 'Error fetching behavior summary' });
  }
});

router.get('/api/teacher/class/analytics', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const mode: AnalyticsMode = req.query.mode === 'all' ? 'all' : 'open';
    const className = req.user!.className!;
    const range = buildRange(req.query.from, req.query.to);

    const stats = getClassAbsenceStats(className, mode, range);
    const heatmap = getClassHeatmapData(className, mode, range);
    const studentTable = getClassStudentTable(className, mode, range);
    res.json({ stats, heatmap, studentTable });
  } catch (error: any) {
    console.error('Error fetching class analytics:', error.message);
    res.status(500).json({ error: 'Error fetching class analytics' });
  }
});

export default router;
