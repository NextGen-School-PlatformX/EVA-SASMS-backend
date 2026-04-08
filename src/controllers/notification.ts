import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const role = (req as any).user.role;
        const notifications = await prisma.notification.findMany({
            where: {
                OR: [
                    { userId },
                    { targetRole: role },
                    { targetRole: 'ALL' }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};

export const markNotificationRead = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const notification = await prisma.notification.update({
            where: { id },
            data: { read: true },
        });
        res.json(notification);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

export const createNotification = async (req: Request, res: Response) => {
    try {
        const { text, type, userId, targetRole, link } = req.body;
        const notification = await prisma.notification.create({
            data: { text, type: type || 'info', userId, targetRole, link },
        });
        res.status(201).json(notification);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating notification', error: error.message });
    }
};

export const markAllRead = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        await prisma.notification.updateMany({
            where: { userId },
            data: { read: true },
        });
        res.json({ message: 'Personal notifications marked as read' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error marking all notifications', error: error.message });
    }
};

