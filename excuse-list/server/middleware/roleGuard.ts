import type { Request, Response, NextFunction } from 'express';

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: 'Nur Schüler können Entschuldigungen einreichen' });
  }
  next();
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'parent') {
    return res.status(403).json({ error: 'Forbidden: Parent role required' });
  }
  next();
}

export function requireTeacher(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden: Teacher role required' });
  }
  next();
}

export function requireTeacherOrParent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'teacher' && req.user?.role !== 'parent') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
