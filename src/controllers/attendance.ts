import type { NextFunction, Request, Response } from 'express';
import { AttendanceService } from '../services/attendanceService.js';
import { AuditService } from '../services/auditService.js';

export const createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = (req as any).user.id;
        const session = await AttendanceService.createSession(req.body, adminId);
        await AuditService.logAction('CREATE_ATTENDANCE_SESSION', adminId, { sessionId: session.id });
        res.status(201).json(session);
    } catch (error) {
        next(error);
    }
};

export const validateScan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const record = await AttendanceService.validateScan(userId, req.body);
        // Check for structured failure response from service
        if (record && record.success === false) {
            return res.status(400).json(record);
        }
        res.status(201).json(record);
    } catch (error) {
        next(error);
    }
};

export const getSessionReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.params.sessionId as string;
        const report = await AttendanceService.getSessionReport(sessionId);
        res.json(report);
    } catch (error) {
        next(error);
    }
};

export const getAllSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessions = await AttendanceService.getAllSessions();
        res.json(sessions);
    } catch (error) {
        next(error);
    }
};

export const autoMarkAbsent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.params.sessionId as string;
        await AttendanceService.autoMarkAbsent(sessionId);
        res.status(200).json({ message: 'Absent records updated' });
    } catch (error) {
        next(error);
    }
};

export const getSessionQR = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.params.sessionId as string;
        const qrDataUrl = await AttendanceService.generateQR(sessionId);
        res.json({ qrDataUrl });
    } catch (error) {
        next(error);
    }
};

export const getMyAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const history = await AttendanceService.getMyAttendance(userId);
        res.json(history);
    } catch (error) {
        next(error);
    }
};
