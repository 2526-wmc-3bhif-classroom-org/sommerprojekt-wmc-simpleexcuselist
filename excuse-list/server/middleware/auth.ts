import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../../model/types';
import { env } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const jwtSecret = env.jwtSecret;

export function verifyJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, jwtSecret) as JwtPayload;
    next();
  } catch {
    return res.status(401).json({ error: 'Authorization header missing' });
  }
}
