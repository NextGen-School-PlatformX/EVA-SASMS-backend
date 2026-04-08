import type { NextFunction, Request, Response } from 'express';
import { APIError } from './errorHandler.js';

export const authorize = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user || !allowedRoles.includes(user.role)) {
            return next(new APIError(403, 'You do not have permission to perform this action'));
        }

        next();
    };
};
