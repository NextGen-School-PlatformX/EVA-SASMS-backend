import prisma from '../lib/prisma.js';
import { AuditService } from './auditService.js';
import { APIError } from '../middleware/errorHandler.js';

export class FinanceService {
    static async getFeeCategories() {
        return prisma.feeCategory.findMany({
            include: { _count: { select: { transactions: true } } }
        });
    }

    static async createFeeCategory(data: any, adminId: string) {
        const category = await prisma.feeCategory.create({ data });
        await AuditService.logAction('CREATE_FEE_CATEGORY', adminId, { categoryId: category.id });
        return category;
    }

    static async processPayment(data: any, adminId: string) {
        const { amount, userId, feeCategoryId, paymentMethod, reference } = data;

        const transaction = await prisma.transaction.create({
            data: {
                amount,
                userId,
                feeCategoryId,
                paymentMethod,
                reference,
                type: 'PAYMENT',
                status: 'COMPLETED'
            }
        });

        await AuditService.logAction('PROCESS_PAYMENT', adminId, { transactionId: transaction.id, userId });
        return transaction;
    }

    static async getTransactions(filters: any = {}) {
        return prisma.transaction.findMany({
            where: filters,
            include: { feeCategory: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async getFees() {
        return prisma.fee.findMany({
            orderBy: { dueDate: 'asc' }
        });
    }

    static async createFee(data: any, adminId: string) {
        const { title, description, amount, dueDate, attachmentUrl, targetUserIds, categoryLabel, paymentMethodLabel } = data;
        const finalDescription =
            description ||
            [
                categoryLabel ? `Category: ${categoryLabel}` : null,
                paymentMethodLabel ? `Payment via: ${paymentMethodLabel}` : null,
            ]
                .filter(Boolean)
                .join(' — ') ||
            '';
        const fee = await prisma.fee.create({
            data: {
                title,
                description: finalDescription,
                amount: parseFloat(amount),
                dueDate: new Date(dueDate),
                attachmentUrl
            }
        });

        // Determine which students should receive this fee
        let students: { id: string }[] = [];

        if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
            // Targeted invoices (single student / cohort)
            students = await prisma.user.findMany({
                where: {
                    role: 'STUDENT',
                    id: { in: targetUserIds as string[] }
                },
                select: { id: true }
            });
        } else {
            // Fallback: issue to all students
            students = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } });
        }

        if (students.length > 0) {
            for (const s of students) {
                const existing = await prisma.feePayment.findUnique({
                    where: { feeId_userId: { feeId: fee.id, userId: s.id } }
                });
                if (!existing) {
                    await prisma.feePayment.create({
                        data: { feeId: fee.id, userId: s.id, status: 'UNPAID' }
                    });
                }
            }

            // Notify all students about the new fee
            for (const s of students) {
                await prisma.notification.create({
                    data: {
                        userId: s.id,
                        text: `رسوم جديدة: "${title}" — ${parseFloat(amount)} جنيه تستحق في ${new Date(dueDate).toLocaleDateString('ar-EG')}`,
                        type: 'info',
                        link: '/student/fees'
                    }
                });
            }
        }

        await AuditService.logAction('CREATE_FEE', adminId, { feeId: fee.id });
        return fee;
    }

    static async getFeePayments(filters: any = {}) {
        return prisma.feePayment.findMany({
            where: filters,
            include: {
                fee: true,
                user: { select: { id: true, name: true, email: true, department: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async approveFeePayment(paymentId: string, adminId: string, approve: boolean, adminNote?: string) {
        const payment = await prisma.feePayment.findUnique({ where: { id: paymentId }, include: { user: true, fee: true } });
        if (!payment) throw new APIError(404, 'Payment not found');

        const updated = await prisma.feePayment.update({
            where: { id: paymentId },
            data: {
                status: approve ? 'APPROVED' : 'REJECTED',
                adminNote: adminNote || null,
                paidAt: approve ? new Date() : null,
            }
        });

        // Notify student
        await prisma.notification.create({
            data: {
                userId: payment.userId,
                text: approve
                    ? `✅ تم الموافقة على سداد رسوم "${payment.fee.title}"`
                    : `❌ تم رفض سداد رسوم "${payment.fee.title}"${adminNote ? ` — ${adminNote}` : ''}`,
                type: approve ? 'success' : 'error',
                link: '/student/fees'
            }
        });

        await AuditService.logAction(approve ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT', adminId, { paymentId });
        return updated;
    }
}
