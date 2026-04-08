import type { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuditService } from '../services/auditService.js';

export const getTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const role = (req as any).user.role;

        const where: any = {};
        if (role === 'APPLICANT' || role === 'STUDENT') {
            where.applicantId = userId;
        }

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: { messages: { orderBy: { createdAt: 'asc' } } },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(tickets);
    } catch (error) {
        next(error);
    }
};

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const { subject, category, message } = req.body;

        const ticket = await prisma.supportTicket.create({
            data: {
                subject,
                category,
                applicantId: userId,
                messages: {
                    create: {
                        senderId: userId,
                        content: message,
                        role: 'USER'
                    }
                }
            },
            include: { messages: true }
        });

        res.status(201).json(ticket);
    } catch (error) {
        next(error);
    }
};

export const respondToTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const role = (req as any).user.role;
        const { id } = req.params;
        const { content } = req.body;

        const ticketCheck = await prisma.supportTicket.findUnique({
            where: { id: id as string }
        });

        if (!ticketCheck || ticketCheck.status === 'RESOLVED' || ticketCheck.status === 'CLOSED') {
            res.status(403).json({ message: 'Cannot respond to a resolved or closed ticket' });
            return;
        }

        const message = await prisma.supportMessage.create({
            data: {
                ticketId: id as string,
                senderId: userId,
                content,
                role: (role === 'ADMIN' || role === 'SUPER_ADMIN') ? 'ADMIN' : 'USER'
            }
        });

        const ticket = await prisma.supportTicket.update({
            where: { id: id as string },
            data: { updatedAt: new Date(), status: (role === 'ADMIN' || role === 'SUPER_ADMIN') ? 'IN_PROGRESS' : 'OPEN' },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
        res.status(201).json(ticket);
    } catch (error) {
        next(error);
    }
};

export const resolveTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const ticket = await prisma.supportTicket.update({
            where: { id: id as string },
            data: { status: 'RESOLVED' }
        });
        res.json(ticket);
    } catch (error) {
        next(error);
    }
};

// ── Admin: Student Complaints ──────────────────────────────────────────────

export const getStudentComplaints = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const complaints = await prisma.complaint.findMany({
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                student: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(complaints);
    } catch (error) {
        next(error);
    }
};

export const addStudentComplaintMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = (req as any).user.id;
        const role = (req as any).user.role;
        const { id } = req.params;
        const { content } = req.body;

        const complaint = await prisma.complaint.findUnique({ where: { id: id as string } });
        if (!complaint) { res.status(404).json({ message: 'Complaint not found' }); return; }
        if (complaint.status === 'CLOSED') { res.status(400).json({ message: 'Complaint is closed' }); return; }

        await prisma.complaintMessage.create({
            data: {
                complaintId: id as string,
                senderId: adminId,
                content,
                role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN'
            }
        });

        const updated = await prisma.complaint.update({
            where: { id: id as string },
            data: { status: 'IN_PROGRESS' },
            include: { messages: { orderBy: { createdAt: 'asc' } }, student: { select: { id: true, name: true, email: true } } }
        });

        res.json(updated);
    } catch (error) {
        next(error);
    }
};

export const resolveStudentComplaint = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const updated = await prisma.complaint.update({
            where: { id: id as string },
            data: { status: 'CLOSED' },
            include: { messages: { orderBy: { createdAt: 'asc' } }, student: { select: { id: true, name: true, email: true } } }
        });
        res.json(updated);
    } catch (error) {
        next(error);
    }
};
