import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import config from '../config';

const JWT_SECRET = config.auth.jwtSecret;

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
}

export interface CustomRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticateToken(req: CustomRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    
    const payload = decoded as any;
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email
    };
    next();
  });
}
