import prisma from '../lib/prisma.js';
import { APIError } from '../middleware/errorHandler.js';

export class AdminService {
    static async getStudents() {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            include: {
                academicYear: true,
                department: true,
                attendance: true,
            },
            orderBy: { name: 'asc' }
        });

        return students.map(student => {
            const attendance = student.attendance || [];
            const presentCount = attendance.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
            const total = attendance.length;
            const attendancePercentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

            return {
                id: student.id,
                name: student.name,
                email: student.email,
                studentId: student.nationalId || student.id,
                year: student.academicYear?.name || 'N/A',
                department: student.department?.name || 'N/A',
                departmentId: student.department?.id || null,
                attendancePercentage,
                status: student.status,
                phoneNumber: student.phoneNumber,
                address: student.address
            };
        });
    }

    static async updateStudent(id: string, data: any) {
        const { departmentId, academicYearId, status, phoneNumber, address } = data;

        const student = await prisma.user.findUnique({
            where: { id }
        });

        if (!student || student.role !== 'STUDENT') {
            throw new APIError(404, 'Student not found');
        }

        return await prisma.user.update({
            where: { id },
            data: {
                departmentId,
                academicYearId,
                status,
                phoneNumber,
                address
            },
            include: {
                department: true,
                academicYear: true
            }
        });
    }

    static async getFeePayments() {
        return await prisma.feePayment.findMany({
            where: {
                status: { not: 'UNPAID' }
            },
            include: {
                fee: true,
                user: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async reviewFeePayment(paymentId: string, status: string, adminNote?: string) {
        const payment = await prisma.feePayment.findUnique({
            where: { id: paymentId }
        });
        if (!payment) throw new APIError(404, 'Payment not found');

        return await prisma.feePayment.update({
            where: { id: paymentId },
            data: {
                status,
                adminNote: adminNote || null
            },
            include: {
                fee: true,
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });
    }
}

