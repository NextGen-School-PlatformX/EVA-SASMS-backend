import prisma from '../lib/prisma.js';

export class SystemService {
    static async getKPIs() {
        const [
            totalStudents,
            activeStudents,
            newApplications,
            pendingAdmissions,
            totalStaff,
            departmentsCount,
            openComplaintsCount,
            feesAgg
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
            prisma.application.count({ where: { status: 'PENDING' } }),
            prisma.application.count({ where: { status: 'UNDER_REVIEW' } }),
            prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
            prisma.department.count(),
            prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
            prisma.transaction.aggregate({
                where: { status: 'PENDING', type: 'PAYMENT' },
                _sum: { amount: true }
            })
        ]);

        return {
            totalStudents,
            activeStudents,
            newApplications,
            pendingAdmissions,
            totalStaff,
            departmentsCount,
            outstandingFeesTotal: feesAgg._sum.amount || 0,
            openComplaintsCount,
        };
    }
}
