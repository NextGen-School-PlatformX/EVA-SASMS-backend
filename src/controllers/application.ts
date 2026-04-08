import type { NextFunction, Request, Response } from 'express';
import { ApplicationService } from '../services/applicationService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const submitApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicantId = (req as any).user.id;
        const application = await ApplicationService.submit(applicantId, req.body, req.files);
        res.status(201).json(application);
    } catch (error) {
        next(error);
    }
};

export const getApplications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applications = await ApplicationService.getAll();
        const flattened = (applications as any[]).map((a: any) => ({
            ...a,
            name: a.applicant?.name,
            email: a.applicant?.email,
            phone: a.applicant?.phoneNumber,
            department: a.preferredDept?.name,
        }));
        res.json(flattened);
    } catch (error) {
        next(error);
    }
};

export const reviewApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status, feedback } = req.body;
        const reviewerId = (req as any).user.id;

        const application = await ApplicationService.review(id as string, reviewerId, status as string, feedback as string);
        res.json(application);
    } catch (error) {
        next(error);
    }
};

export const scheduleExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { examDate, examLocation, examNotes } = req.body;
        const adminId = (req as any).user.id;

        if (!examDate || !examLocation) {
            return res.status(400).json({ error: 'examDate and examLocation are required' });
        }

        const application = await ApplicationService.scheduleExam(id as string, adminId, { examDate, examLocation, examNotes });
        res.json(application);
    } catch (error) {
        next(error);
    }
};

export const scheduleInterview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { interviewDate, interviewLocation, interviewNotes } = req.body;
        const adminId = (req as any).user.id;

        if (!interviewDate || !interviewLocation) {
            return res.status(400).json({ error: 'interviewDate and interviewLocation are required' });
        }

        const application = await ApplicationService.scheduleInterview(id as string, adminId, { interviewDate, interviewLocation, interviewNotes });
        res.json(application);
    } catch (error) {
        next(error);
    }
};

// ─── Bulk Mark Under Review (PENDING -> UNDER_REVIEW only) ───────────────────
export const bulkMarkUnderReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { applicationIds } = req.body;
        const adminId = (req as any).user.id;

        if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
            return res.status(400).json({ error: 'applicationIds (array) is required' });
        }

        const results = await ApplicationService.bulkMarkUnderReview(applicationIds, adminId);
        res.json(results);
    } catch (error) {
        next(error);
    }
};

// ─── Bulk Schedule Exam ─────────────────────────────────────────────────────
export const bulkScheduleExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { applicationIds, examDate, examLocation, examNotes } = req.body;
        const adminId = (req as any).user.id;

        if (!Array.isArray(applicationIds) || applicationIds.length === 0 || !examDate || !examLocation) {
            return res.status(400).json({ error: 'applicationIds (array), examDate and examLocation are required' });
        }

        const results = await ApplicationService.bulkScheduleExam(applicationIds, adminId, { examDate, examLocation, examNotes });
        res.json(results);
    } catch (error) {
        next(error);
    }
};

// ─── Bulk Schedule Interview ────────────────────────────────────────────────
export const bulkScheduleInterview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { applicationIds, interviewDate, interviewLocation, interviewNotes } = req.body;
        const adminId = (req as any).user.id;

        if (!Array.isArray(applicationIds) || applicationIds.length === 0 || !interviewDate || !interviewLocation) {
            return res.status(400).json({ error: 'applicationIds (array), interviewDate and interviewLocation are required' });
        }

        const results = await ApplicationService.bulkScheduleInterview(applicationIds, adminId, { interviewDate, interviewLocation, interviewNotes });
        res.json(results);
    } catch (error) {
        next(error);
    }
};

export const convertToStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const updatedUser = await ApplicationService.convertToStudent(id as string, req.body);
        res.json({ message: 'Applicant successfully converted to Student', user: updatedUser });
    } catch (error) {
        next(error);
    }
};

export const getMyApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicantId = (req as any).user.id;
        const application = await ApplicationService.getByApplicantId(applicantId);
        res.json(application);
    } catch (error) {
        next(error);
    }
};

export const claimStudentRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicantId = (req as any).user.id;
        const updatedUser = await ApplicationService.claimStudentRole(applicantId);
        res.json({ message: 'Welcome to the school! Your role has been updated to Student.', user: updatedUser });
    } catch (error) {
        next(error);
    }
};

export const serveDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { filename: rawFilename } = req.params;
        if (!rawFilename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const filename = path.basename(rawFilename as string);
        const uploadDir = path.resolve(__dirname, '../../uploads');
        const filePath = path.join(uploadDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
};

// ─── NEW: Set Exam Score + Note ───────────────────────────────────────────────
export const setExamScore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { examScore, examNote } = req.body;
        const adminId = (req as any).user.id;
        const prisma = (await import('../lib/prisma.js')).default;
        const updated = await prisma.application.update({
            where: { id: id as string },
            data: {
                examScore: examScore != null ? Number(examScore) : undefined,
                examNote: examNote ?? undefined,
                reviewerId: adminId,
            }
        });
        res.json(updated);
    } catch (error) { next(error); }
};

// ─── NEW: Set Interview Score + Criteria ─────────────────────────────────────
export const setInterviewScore = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { interviewScore, interviewNote, interviewCriteria } = req.body;
        const adminId = (req as any).user.id;
        const prisma = (await import('../lib/prisma.js')).default;
        const updated = await prisma.application.update({
            where: { id: id as string },
            data: {
                interviewScore: interviewScore != null ? Number(interviewScore) : undefined,
                interviewNote: interviewNote ?? undefined,
                interviewCriteria: interviewCriteria ? JSON.stringify(interviewCriteria) : undefined,
                reviewerId: adminId,
            }
        });
        res.json(updated);
    } catch (error) { next(error); }
};

// ─── NEW: Leaderboard ─────────────────────────────────────────────────────────
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prisma = (await import('../lib/prisma.js')).default;
        const apps = await prisma.application.findMany({
            where: { status: { not: 'REJECTED' } },
            include: { applicant: { select: { name: true, email: true, phoneNumber: true } }, preferredDept: { select: { name: true } } },
            orderBy: { ministryScore: 'desc' },
        });
        const leaderboard = (apps as any[]).map((a: any, i: number) => ({
            rank: i + 1,
            id: a.id,
            name: a.applicant.name,
            email: a.applicant.email,
            phone: a.applicant.phoneNumber || null,
            department: a.preferredDept?.name || 'N/A',
            ministryScore: a.ministryScore,
            examScore: (a as any).examScore,
            interviewScore: (a as any).interviewScore,
            totalScore: (((a.ministryScore || 0) + ((a as any).examScore || 0) + ((a as any).interviewScore || 0)) /
                ([a.ministryScore, (a as any).examScore, (a as any).interviewScore].filter((x: any) => x != null).length || 1)),
            status: a.status,
        }));
        res.json(leaderboard);
    } catch (error) { next(error); }
};

// ─── NEW: Admission Window ────────────────────────────────────────────────────
import fsAW from 'fs';
const WINDOW_FILE = process.cwd() + '/admission_window.json';

export const getAdmissionWindow = async (_req: Request, res: Response) => {
    try {
        if (fsAW.existsSync(WINDOW_FILE)) {
            res.json(JSON.parse(fsAW.readFileSync(WINDOW_FILE, 'utf-8')));
        } else {
            res.json({ isOpen: false, startDate: null, endDate: null });
        }
    } catch { res.json({ isOpen: false, startDate: null, endDate: null }); }
};

export const setAdmissionWindow = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, isOpen } = req.body;
        const data = { isOpen: isOpen ?? true, startDate: startDate || null, endDate: endDate || null };
        fsAW.writeFileSync(WINDOW_FILE, JSON.stringify(data, null, 2));
        res.json(data);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

// ─── Threshold ────────────────────────────────────────────────────────────────
import fsT from 'fs';
const THRESHOLD_FILE = process.cwd() + '/admission_threshold.json';

export const getAdmissionThreshold = async (_req: Request, res: Response) => {
    try {
        if (fsT.existsSync(THRESHOLD_FILE)) {
            res.json(JSON.parse(fsT.readFileSync(THRESHOLD_FILE, 'utf-8')));
        } else {
            const prisma = (await import('../lib/prisma.js')).default;
            const schoolInfo = await prisma.schoolInfo.findFirst();
            res.json({ minScore: schoolInfo?.minAdmissionScore ?? 0 });
        }
    } catch { res.json({ minScore: 0 }); }
};

export const setAdmissionThreshold = async (req: Request, res: Response) => {
    try {
        const { minScore } = req.body;
        const data = { minScore: Number(minScore) || 0 };
        fsT.writeFileSync(THRESHOLD_FILE, JSON.stringify(data, null, 2));
        // Keep SchoolInfo in sync for auto-rejection logic
        const prisma = (await import('../lib/prisma.js')).default;
        const schoolInfo = await prisma.schoolInfo.findFirst();
        if (schoolInfo) {
            await prisma.schoolInfo.update({ where: { id: schoolInfo.id }, data: { minAdmissionScore: data.minScore } });
        } else {
            await prisma.schoolInfo.create({ data: { name: 'SASMS', minAdmissionScore: data.minScore } });
        }
        res.json(data);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};
