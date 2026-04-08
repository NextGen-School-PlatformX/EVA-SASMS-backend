import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { APIError } from './errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new APIError(401, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        throw new APIError(401, 'Authentication required');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            throw new APIError(401, 'Token expired. Please log in again.');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new APIError(401, 'Invalid token. Authentication failed.');
        }
        throw new APIError(401, 'Authentication failed');
    }
};

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new APIError(403, 'Unauthorized');
        }
        next();
    };
};
