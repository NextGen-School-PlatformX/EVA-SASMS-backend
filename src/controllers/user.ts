import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/authService.js';
import { AuditService } from '../services/auditService.js';
import crypto from 'crypto';

// Role mapping from frontend display names to backend enum values
const ROLE_MAP: Record<string, string> = {
    'SuperAdmin': 'SUPER_ADMIN',
    'Admin': 'ADMIN',
    'Student': 'STUDENT',
    'Applicant': 'APPLICANT',
    // Already uppercase values pass through
    'SUPER_ADMIN': 'SUPER_ADMIN',
    'ADMIN': 'ADMIN',
    'STUDENT': 'STUDENT',
    'APPLICANT': 'APPLICANT',
};

export const getUsers = async (req: Request, res: Response) => {
    const { role } = req.query;
    try {
        const users = await prisma.user.findMany({
            where: role ? { role: role as string } : {},
            orderBy: { createdAt: 'desc' },
            include: { department: true }
        });

        // Map users to the format expected by frontend
        const mapped = users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department?.name || '',
            status: u.status === 'ACTIVE' ? 'Active' : (u.status === 'SUSPENDED' ? 'Suspended' : 'Inactive'),
            lastActive: u.updatedAt?.toISOString?.() || new Date().toISOString(),
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

export const createStaff = async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { name, email, role, department, departmentId, status } = req.body;

        // Map frontend role name to backend enum
        const mappedRole = ROLE_MAP[role] || 'ADMIN';

        // Auto-generate password if none provided
        const password = req.body.password || crypto.randomBytes(8).toString('hex');

        // Find departmentId if a department name was provided instead of ID
        let resolvedDeptId = departmentId;
        if (!resolvedDeptId && department) {
            const dept = await prisma.department.findFirst({ where: { name: department } });
            resolvedDeptId = dept?.id;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: mappedRole,
                departmentId: resolvedDeptId || null,
                status: 'ACTIVE',
            },
            include: { department: true },
        });

        await AuditService.logAction('CREATE_STAFF', adminId, { targetUserId: user.id, role: mappedRole });

        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: (user as any).department?.name || '',
            status: 'Active',
            lastActive: new Date().toISOString(),
            generatedPassword: password, // Return generated password so admin can share it
        });
    } catch (error: any) {
        console.error('Create user error:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error creating staff' });
    }
};

export const updateUserStatus = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status } = req.body;
    const adminId = (req as any).user?.id;
    try {
        let mappedStatus = 'ACTIVE';
        if (status === 'Inactive' || status === 'INACTIVE') mappedStatus = 'INACTIVE';
        else if (status === 'SUSPENDED') mappedStatus = 'SUSPENDED';
        else if (status === 'Active' || status === 'ACTIVE') mappedStatus = 'ACTIVE';
        const user = await prisma.user.update({
            where: { id },
            data: { status: mappedStatus },
            include: { department: true },
        });
        await AuditService.logAction('USER_STATUS_CHANGE', adminId, { targetUserId: id, newStatus: mappedStatus }, (req as any).ip);
        const mapped = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: (user as any).department?.name || '',
            status: user.status === 'ACTIVE' ? 'Active' : (user.status === 'SUSPENDED' ? 'Suspended' : 'Inactive'),
            lastActive: user.updatedAt?.toISOString?.() || new Date().toISOString(),
        };
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: 'Error updating user status', error });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.$transaction(async (tx) => {
            // Delete all related records first (foreign key constraints)
            await tx.admissionDecisionLog.deleteMany({ where: { OR: [{ adminId: id }, { application: { applicantId: id } }] } });
            await tx.application.deleteMany({ where: { applicantId: id } });
            await tx.application.updateMany({ where: { reviewerId: id }, data: { reviewerId: null } });
            await tx.staff.deleteMany({ where: { userId: id } });
            const tickets = await tx.supportTicket.findMany({ where: { applicantId: id }, select: { id: true } });
            if (tickets.length > 0) {
                await tx.supportMessage.deleteMany({ where: { ticketId: { in: tickets.map(t => t.id) } } });
            }
            await tx.supportTicket.deleteMany({ where: { applicantId: id } });
            await tx.attendanceRecord.deleteMany({ where: { studentId: id } });
            await tx.eventEnrollment.deleteMany({ where: { userId: id } });
            await tx.transaction.deleteMany({ where: { userId: id } });
            await tx.notification.deleteMany({ where: { userId: id } });
            await tx.auditLog.deleteMany({ where: { userId: id } });
            await tx.feePayment.deleteMany({ where: { userId: id } });
            const complaints = await tx.complaint.findMany({ where: { studentId: id }, select: { id: true } });
            if (complaints.length > 0) {
                await tx.complaintMessage.deleteMany({ where: { complaintId: { in: complaints.map(c => c.id) } } });
            }
            await tx.complaint.deleteMany({ where: { studentId: id } });
            await tx.activityParticipant.deleteMany({ where: { userId: id } });
            await tx.employeeAttendance.deleteMany({ where: { employeeId: id } });
            await tx.passwordResetToken.deleteMany({ where: { userId: id } });
            // AttendanceSession has createdBy - set to first admin or delete sessions
            const sessions = await tx.attendanceSession.findMany({ where: { createdBy: id } });
            if (sessions.length > 0) {
                const admin = await tx.user.findFirst({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, id: { not: id } } });
                if (admin) {
                    await tx.attendanceSession.updateMany({ where: { createdBy: id }, data: { createdBy: admin.id } });
                } else {
                    await tx.attendanceRecord.deleteMany({ where: { sessionId: { in: sessions.map(s => s.id) } } });
                    await tx.attendanceSession.deleteMany({ where: { createdBy: id } });
                }
            }
            await tx.department.updateMany({ where: { headId: id }, data: { headId: null } });
            await tx.user.delete({ where: { id } });
        });
        res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: error?.message || 'Error deleting user', error: String(error) });
    }
};
