import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuditService } from '../services/auditService.js';

export const getEvents = async (req: Request, res: Response) => {
    try {
        const events = await prisma.event.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(events);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching events', error: error.message });
    }
};

export const createEvent = async (req: Request, res: Response) => {
    try {
        const { title, date, category, organizer, location, capacity } = req.body;
        const event = await prisma.event.create({
            data: {
                title,
                date,
                category: category || 'General',
                organizer: organizer || 'Admin',
                location: location || 'TBD',
                capacity: capacity || 100,
                attendeesCount: 0,
                status: 'Upcoming',
            },
        });
        const adminId = (req as any).user?.id;
        if (adminId) {
            await AuditService.logAction('CREATE_EVENT', adminId, { eventId: event.id, title: event.title });

            // Notify Super Admin
            const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
            await prisma.notification.create({
                data: {
                    text: `New Activity Created: ${event.title} by ${adminUser?.name || 'Admin'}`,
                    type: 'ACTIVITY',
                    targetRole: 'SUPER_ADMIN',
                    link: '/superadmin/activities'
                }
            });

            // Notify all students about the new activity
            const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } });
            if (students.length > 0) {
                await prisma.notification.createMany({
                    data: students.map(s => ({
                        userId: s.id,
                        text: `New Activity: "${event.title}" on ${event.date}. Check it out!`,
                        type: 'ACTIVITY',
                        link: '/student/activities'
                    }))
                });
            }
        }
        res.status(201).json(event);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating event', error: error.message });
    }
};

export const deleteEvent = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await prisma.event.delete({ where: { id } });
        res.json({ message: 'Event deleted' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting event', error: error.message });
    }
};

export const joinEvent = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = (req as any).user.id;

        // Check if already enrolled
        const existing = await prisma.eventEnrollment.findUnique({
            where: { eventId_userId: { eventId, userId } }
        });
        if (existing) return res.status(400).json({ message: 'Already enrolled' });

        // Check capacity
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        if (event.attendeesCount >= event.capacity) return res.status(400).json({ message: 'Event is full' });

        // Use transaction to ensure atomicity
        const result = await prisma.$transaction([
            prisma.eventEnrollment.create({ data: { eventId, userId } }),
            prisma.event.update({
                where: { id: eventId },
                data: { attendeesCount: { increment: 1 } }
            })
        ]);

        res.json({ message: 'Enrolled successfully', enrollment: result[0] });
    } catch (error: any) {
        res.status(500).json({ message: 'Error joining event', error: error.message });
    }
};

export const leaveEvent = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = (req as any).user.id;

        await prisma.$transaction([
            prisma.eventEnrollment.delete({
                where: { eventId_userId: { eventId, userId } }
            }),
            prisma.event.update({
                where: { id: eventId },
                data: { attendeesCount: { decrement: 1 } }
            })
        ]);

        res.json({ message: 'Unenrolled successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error leaving event', error: error.message });
    }
};

