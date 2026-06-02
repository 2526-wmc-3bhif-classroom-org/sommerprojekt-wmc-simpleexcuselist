import { Router } from 'express';
import { verifyJwt } from '../middleware/auth';
import { requireTeacher } from '../middleware/roleGuard';
import { getStudentsByClass, getStudentSignedAbsences } from '../data/teacherRepository';
import {
  getSubjectAbsenceStats,
  getStudentHeatmapData,
  getClassAbsenceStats,
  getClassHeatmapData,
  getClassStudentTable,
  type AnalyticsMode,
} from '../data/analyticsRepository';

const router = Router();

router.get('/api/teacher/students', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const students = getStudentsByClass(req.user!.className!);
    res.json(students);
  } catch (error: any) {
    console.error('Error fetching teacher students:', error.message);
    res.status(500).json({ error: 'Error fetching students', details: error.message });
  }
});

router.get('/api/teacher/students/:studentId/absences', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const { studentId } = req.params;
    const absences = getStudentSignedAbsences(studentId, req.user!.className!);

    if (absences === null) {
      return res.status(404).json({ error: 'Student not found in your class' });
    }

    res.json(absences);
  } catch (error: any) {
    console.error('Error fetching student absences:', error.message);
    res.status(500).json({ error: 'Error fetching absences', details: error.message });
  }
});

router.get('/api/teacher/students/:studentId/analytics', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const mode: AnalyticsMode = req.query.mode === 'all' ? 'all' : 'open';
    const studentId = Number(req.params.studentId);
    const className = req.user!.className!;

    const stats = getSubjectAbsenceStats(studentId, className, mode);
    if (stats === null) {
      return res.status(404).json({ error: 'Student not found in your class' });
    }

    const heatmap = getStudentHeatmapData(studentId, className, mode);
    res.json({ stats, heatmap });
  } catch (error: any) {
    console.error('Error fetching student analytics:', error.message);
    res.status(500).json({ error: 'Error fetching analytics', details: error.message });
  }
});

router.get('/api/teacher/class/analytics', verifyJwt, requireTeacher, async (req, res) => {
  try {
    const mode: AnalyticsMode = req.query.mode === 'all' ? 'all' : 'open';
    const className = req.user!.className!;

    const stats = getClassAbsenceStats(className, mode);
    const heatmap = getClassHeatmapData(className, mode);
    const studentTable = getClassStudentTable(className, mode);
    res.json({ stats, heatmap, studentTable });
  } catch (error: any) {
    console.error('Error fetching class analytics:', error.message);
    res.status(500).json({ error: 'Error fetching class analytics', details: error.message });
  }
});

export default router;
