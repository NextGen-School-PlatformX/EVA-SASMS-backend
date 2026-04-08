import prisma from '../lib/prisma.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export class StudentService {
    static async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                department: true,
                academicYear: true,
                application: true,
            }
        });

        if (!user) throw new APIError(404, 'Student not found');
        return user;
    }

    static async updateProfile(userId: string, data: any) {
        const { name, phoneNumber, address, avatarUrl, email } = data;

        if (email) {
            const existing = await prisma.user.findFirst({
                where: { email, NOT: { id: userId } }
            });
            if (existing) throw new APIError(400, 'Email already in use');
        }

        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        if (address !== undefined) updateData.address = address;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

        return await prisma.user.update({
            where: { id: userId },
            data: updateData
        });
    }

    static async getAdmissionsSummary(userId: string) {
        const application = await prisma.application.findUnique({
            where: { applicantId: userId },
            include: {
                preferredDept: true,
            }
        });

        if (!application) return null;
        return application;
    }

    static async getFees(userId: string) {
        return await prisma.feePayment.findMany({
            where: { userId },
            include: {
                fee: true
            },
            orderBy: {
                fee: {
                    dueDate: 'asc'
                }
            }
        });
    }

    static async getComplaints(userId: string) {
        return await prisma.complaint.findMany({
            where: { studentId: userId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createComplaint(userId: string, data: any) {
        const { subject, message } = data;
        return await prisma.complaint.create({
            data: {
                subject,
                studentId: userId,
                messages: {
                    create: {
                        senderId: userId,
                        content: message,
                        role: 'STUDENT'
                    }
                }
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
    }

    static async addComplaintMessage(userId: string, complaintId: string, content: string) {
        // Verify complaint exists and belongs to student
        const complaint = await prisma.complaint.findUnique({
            where: { id: complaintId },
            include: { student: true }
        });

        if (!complaint) throw new APIError(404, 'Complaint not found');
        if (complaint.studentId !== userId) throw new APIError(403, 'Unauthorized');
        if (complaint.status === 'CLOSED') throw new APIError(400, 'Cannot message on a closed complaint');

        const message = await prisma.complaintMessage.create({
            data: {
                complaintId,
                senderId: userId,
                content,
                role: 'STUDENT'
            }
        });

        // Trigger notification for admin (mock for now or implement if notification service exists)
        // await NotificationService.notifyAdmin('NEW_COMPLAINT_MESSAGE', { complaintId, senderId: userId });

        return message;
    }

    static async getActivities(userId: string) {
        const activities = await prisma.event.findMany({
            include: {
                enrollments: {
                    where: { userId }
                },
                _count: {
                    select: { enrollments: true }
                }
            },
            orderBy: { date: 'asc' }
        });

        return activities.map(event => ({
            ...event,
            isJoined: event.enrollments.length > 0,
            _count: { participants: event._count.enrollments },
            enrollments: undefined
        }));
    }

    static async joinActivity(userId: string, eventId: string) {
        // Verify event exists
        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });
        if (!event) throw new APIError(404, 'Activity not found');

        // Prevent duplicate joins
        const existing = await prisma.eventEnrollment.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId
                }
            }
        });
        if (existing) throw new APIError(400, 'Already joined this activity');

        // Use transaction to update attendeesCount and create enrollment
        return await prisma.$transaction([
            prisma.eventEnrollment.create({
                data: { userId, eventId }
            }),
            prisma.event.update({
                where: { id: eventId },
                data: { attendeesCount: { increment: 1 } }
            })
        ]);
    }

    static async leaveActivity(userId: string, eventId: string) {
        return await prisma.$transaction([
            prisma.eventEnrollment.delete({
                where: {
                    eventId_userId: {
                        eventId,
                        userId
                    }
                }
            }),
            prisma.event.update({
                where: { id: eventId },
                data: { attendeesCount: { decrement: 1 } }
            })
        ]);
    }

    static async getNotifications(userId: string) {
        return await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async payFee(userId: string, feeId: string, amountPaid: number, receiptImage: string | null, receiptNumber?: string) {
        // Verify fee exists
        const fee = await prisma.fee.findUnique({ where: { id: feeId } });
        if (!fee) throw new APIError(404, 'Fee not found');

        // Store receiptNumber in adminNote field (reusing for reference number)
        const adminNote = receiptNumber ? `REF#${receiptNumber}` : undefined;

        // Upsert fee payment record
        return await prisma.feePayment.upsert({
            where: {
                feeId_userId: { feeId, userId }
            },
            update: {
                amountPaid,
                receiptImage,
                adminNote: adminNote || undefined,
                status: 'PENDING',
                paidAt: new Date()
            },
            create: {
                feeId,
                userId,
                amountPaid,
                receiptImage,
                adminNote: adminNote || null,
                status: 'PENDING',
                paidAt: new Date()
            },
            include: { fee: true }
        });
    }
}
