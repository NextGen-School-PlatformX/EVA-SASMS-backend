import type { NextFunction, Request, Response } from 'express';
import { StudentService } from '../services/studentService.js';

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const profile = await StudentService.getProfile(userId);
        res.json(profile);
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const updated = await StudentService.updateProfile(userId, req.body);
        res.json(updated);
    } catch (error) {
        next(error);
    }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: 'No avatar file uploaded' });
        const avatarPath = 'uploads/' + file.filename;
        const updated = await StudentService.updateProfile(userId, { avatarUrl: avatarPath });
        res.json({ message: 'Avatar updated successfully', avatarUrl: avatarPath, user: updated });
    } catch (error) {
        next(error);
    }
};

export const getAdmissionsSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const summary = await StudentService.getAdmissionsSummary(userId);
        res.json(summary ?? null);
    } catch (error) {
        next(error);
    }
};

export const getFees = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const fees = await StudentService.getFees(userId);
        res.json(fees);
    } catch (error) {
        next(error);
    }
};

// Unused - Attendance handled via AttendanceController.validateScan
/*
export const markAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { qrCode, latitude, longitude } = req.body;
        const record = await StudentService.markAttendance(userId, qrCode, latitude, longitude);
        res.json(record);
    } catch (error) {
        next(error);
    }
};
*/

export const getComplaints = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const complaints = await StudentService.getComplaints(userId);
        res.json(complaints);
    } catch (error) {
        next(error);
    }
};

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const complaint = await StudentService.createComplaint(userId, req.body);
        res.status(201).json(complaint);
    } catch (error) {
        next(error);
    }
};

export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const activities = await StudentService.getActivities(userId);
        res.json(activities);
    } catch (error) {
        next(error);
    }
};

export const joinActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { id: activityId } = req.params;
        const participation = await StudentService.joinActivity(userId, activityId as string);
        res.status(201).json(participation);
    } catch (error) {
        next(error);
    }
};

export const leaveActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { activityId } = req.params;
        await StudentService.leaveActivity(userId, activityId as string);
        res.status(204).end();
    } catch (error) {
        next(error);
    }
};

export const addComplaintMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { id: complaintId } = req.params;
        const { message } = req.body;
        const newMessage = await StudentService.addComplaintMessage(userId, complaintId as string, message);
        res.status(201).json(newMessage);
    } catch (error) {
        next(error);
    }
};

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const notifications = await StudentService.getNotifications(userId);
        res.json(notifications);
    } catch (error) {
        next(error);
    }
};

export const payFee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { feeId, amountPaid, receiptNumber } = req.body;
        const receiptPath = (req as any).file ? `uploads/${(req as any).file.filename}` : null;
        const result = await StudentService.payFee(userId, feeId, parseFloat(amountPaid), receiptPath, receiptNumber);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
};
