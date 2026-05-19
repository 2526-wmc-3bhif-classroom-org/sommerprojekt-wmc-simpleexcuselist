export interface Parent {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  createdAt?: string;
}

export interface Teacher {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  className: string;
  createdAt?: string;
}

export interface JwtPayload {
  role: 'student' | 'teacher' | 'parent';
  username?: string;
  untisId?: number;
  teacherId?: string;
  className?: string;
  parentId?: string;
}
