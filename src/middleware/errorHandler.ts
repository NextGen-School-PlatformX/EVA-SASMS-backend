import type { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger.js';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log error
    logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
        stack: err.stack,
    });

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message: process.env.NODE_ENV === 'production' && statusCode === 500
            ? 'Something went wrong!'
            : message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

export class APIError extends Error implements AppError {
    constructor(public statusCode: number, public message: string, public isOperational = true) {
        super(message);
        Object.setPrototypeOf(this, APIError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
