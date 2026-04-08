import type { NextFunction, Request, Response } from 'express';
import { AcademicService } from '../services/academicService.js';
import { AuditService } from '../services/auditService.js';

export const getYears = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const years = await AcademicService.getAllYears();
        res.json(years);
    } catch (error) {
        next(error);
    }
};

export const createYear = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name } = req.body;
        const year = await AcademicService.createYear(name);
        const adminId = (req as any).user?.id;
        await AuditService.logAction('CREATE_YEAR', adminId, { yearId: year.id, name: year.name });
        res.status(201).json(year);
    } catch (error) {
        next(error);
    }
};

export const deleteYear = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await AcademicService.deleteYear(id as string);
        const adminId = (req as any).user?.id;
        await AuditService.logAction('DELETE_YEAR', adminId, { yearId: id });
        res.json({ message: 'Year deleted' });
    } catch (error) {
        next(error);
    }
};

export const getDepartments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { yearId } = req.params;
        const departments = await AcademicService.getDepartmentsByYear(yearId as string);
        res.json(departments);
    } catch (error) {
        next(error);
    }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { yearId } = req.params;
        const { name, description, icon } = req.body;
        const dept = await AcademicService.createDepartment(yearId as string, name as string, description as string, icon as string);
        const adminId = (req as any).user?.id;
        await AuditService.logAction('CREATE_DEPARTMENT', adminId, { yearId, deptId: dept.id, name });
        res.status(201).json(dept);
    } catch (error) {
        next(error);
    }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await AcademicService.deleteDepartment(id as string);
        const adminId = (req as any).user?.id;
        await AuditService.logAction('DELETE_DEPARTMENT', adminId, { departmentId: id });
        res.json({ message: 'Department deleted' });
    } catch (error) {
        next(error);
    }
};

export const getClasses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { departmentId } = req.params;
        const classes = await AcademicService.getClassesByDepartment(departmentId as string);
        res.json(classes);
    } catch (error) {
        next(error);
    }
};

export const createClass = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { departmentId } = req.params;
        const { name } = req.body;
        const cls = await AcademicService.createClass(departmentId as string, name as string);
        const adminId = (req as any).user?.id;
        await AuditService.logAction('CREATE_CLASS', adminId, { departmentId, classId: cls.id, name });
        res.status(201).json(cls);
    } catch (error) {
        next(error);
    }
};

export const deleteClass = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await AcademicService.deleteClass(id as string);
        const adminId = (req as any).user?.id;
        await AuditService.logAction('DELETE_CLASS', adminId, { classId: id });
        res.json({ message: 'Class deleted' });
    } catch (error) {
        next(error);
    }
};

export const getClassStudents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { classId } = req.params;
        const students = await AcademicService.getStudentsByClass(classId as string);
        res.json(students);
    } catch (error) {
        next(error);
    }
};
