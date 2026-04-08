import prisma from '../lib/prisma.js';

export class AcademicService {
    // --- Years ---
    static async getAllYears() {
        return prisma.academicYear.findMany({
            include: {
                _count: { select: { departments: true, users: true } }
            },
            orderBy: { name: 'asc' }
        });
    }

    static async createYear(name: string) {
        return prisma.academicYear.create({
            data: { name }
        });
    }

    static async deleteYear(id: string) {
        return prisma.academicYear.delete({ where: { id } });
    }

    // --- Departments ---
    static async getDepartmentsByYear(yearId: string) {
        return prisma.department.findMany({
            where: { yearId },
            include: {
                _count: { select: { classes: true, users: true } }
            }
        });
    }

    static async createDepartment(yearId: string, name: string, description?: string, icon?: string) {
        return prisma.department.create({
            data: {
                name,
                description,
                icon,
                yearId
            }
        });
    }

    static async deleteDepartment(id: string) {
        return prisma.department.delete({ where: { id } });
    }

    // --- Classes ---
    static async getClassesByDepartment(departmentId: string) {
        return prisma.academicClass.findMany({
            where: { departmentId },
            include: {
                _count: { select: { users: true } }
            }
        });
    }

    static async createClass(departmentId: string, name: string) {
        return prisma.academicClass.create({
            data: {
                name,
                departmentId
            }
        });
    }

    static async deleteClass(id: string) {
        return prisma.academicClass.delete({ where: { id } });
    }

    static async getStudentsByClass(classId: string) {
        return prisma.user.findMany({
            where: { classId, role: 'STUDENT' },
            orderBy: { name: 'asc' }
        });
    }
}
