import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuditService } from '../services/auditService.js';

export const getDepartments = async (req: Request, res: Response) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                users: {
                    select: {
                        role: true,
                        attendance: {
                            select: { status: true }
                        }
                    }
                }
            }
        });

        // Compute studentCount, staffCount, attendanceRate for each department
        const mapped = departments.map((dept: any) => {
            const students = dept.users.filter((u: any) => u.role === 'STUDENT');
            const staffMembers = dept.users.filter((u: any) => ['ADMIN', 'SUPER_ADMIN'].includes(u.role));

            // Calculate real attendance rate across all students in the dept
            const allAttendance = students.flatMap((s: any) => s.attendance);
            const attendanceRate = allAttendance.length > 0
                ? Math.floor((allAttendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length / allAttendance.length) * 100)
                : 100;

            return {
                id: dept.id,
                name: dept.name,
                description: dept.description,
                icon: dept.icon,
                headId: dept.headId,
                studentCount: students.length,
                staffCount: staffMembers.length,
                attendanceRate,
                financialStatus: students.length > 3 ? 'Healthy' : students.length > 0 ? 'Warning' : 'Deficit',
                createdAt: dept.createdAt,
                updatedAt: dept.updatedAt,
            };
        });

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching departments', error });
    }
};

export const createDepartment = async (req: Request, res: Response) => {
    const { name, description, icon } = req.body;
    try {
        const department = await prisma.department.create({
            data: {
                name: name as string,
                description: description as string,
                icon: icon as string
            }
        });
        const adminId = (req as any).user?.id;
        const adminRole = (req as any).user?.role;

        // Notify Super Admin if created by a regular Admin
        if (adminRole === 'ADMIN') {
            await prisma.notification.create({
                data: {
                    text: `New department created: ${department.name} by Admin`,
                    type: 'info',
                    targetRole: 'SUPER_ADMIN',
                    link: '/superadmin/departments'
                }
            });
        }

        await AuditService.logAction('CREATE_DEPARTMENT', adminId, { departmentId: department.id, name: department.name });
        res.status(201).json({
            ...department,
            studentCount: 0,
            staffCount: 0,
            attendanceRate: 0,
            financialStatus: 'Deficit',
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating department', error });
    }
};

export const updateDepartment = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { name, description, icon, headId } = req.body;
    try {
        const department = await prisma.department.update({
            where: { id },
            data: {
                name: name as string,
                description: description as string,
                icon: icon as string,
                headId: headId as string
            }
        });
        const adminId = (req as any).user?.id;
        await AuditService.logAction('UPDATE_DEPARTMENT', adminId, { departmentId: department.id });
        res.json(department);
    } catch (error) {
        res.status(500).json({ message: 'Error updating department', error });
    }
};

export const deleteDepartment = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        await prisma.department.delete({ where: { id } });
        const adminId = (req as any).user?.id;
        await AuditService.logAction('DELETE_DEPARTMENT', adminId, { departmentId: id });
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting department', error });
    }
};
