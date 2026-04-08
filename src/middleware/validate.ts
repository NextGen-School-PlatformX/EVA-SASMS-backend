import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { APIError } from './errorHandler.js';

export const validate = (schema: ZodSchema) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            return next();
        } catch (error: any) {
            if (error instanceof ZodError) {
                const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                return next(new APIError(400, message));
            }
            return next(error);
        }
    };
