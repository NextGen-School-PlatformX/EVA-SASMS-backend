import type { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/adminService.js';

export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const students = await AdminService.getStudents();
        res.json(students);
    } catch (error) {
        next(error);
    }
};

export const updateStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const updated = await AdminService.updateStudent(id, req.body);
        res.json(updated);
    } catch (error) {
        next(error);
    }
};

export const getFeePayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payments = await AdminService.getFeePayments();
        res.json(payments);
    } catch (error) {
        next(error);
    }
};

export const reviewFeePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body;
        const result = await AdminService.reviewFeePayment(id as string, status, adminNote);
        res.json(result);
    } catch (error) {
        next(error);
    }
};


// ── Promote / Demote Students ─────────────────────────────────────────────────
export const promoteStudents = async (req: any, res: any) => {
    try {
        const { studentIds, targetYearId, targetYearName } = req.body;
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: 'studentIds array required' });
        }
        const prisma = (await import('../lib/prisma.js')).default;

        // Find target year
        let yearRecord = null;
        if (targetYearId) {
            yearRecord = await prisma.academicYear.findUnique({ where: { id: targetYearId } });
        } else if (targetYearName) {
            yearRecord = await prisma.academicYear.findFirst({ where: { name: { contains: targetYearName } } });
        }

        for (const id of studentIds) {
            const updateData: any = {};
            if (yearRecord) {
                updateData.academicYearId = yearRecord.id;
                updateData.admissionYear = yearRecord.name;
            }
            await prisma.user.update({ where: { id }, data: updateData });
        }

        res.json({ success: true, count: studentIds.length, newYear: yearRecord?.name || targetYearName });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateStudentStatus = async (req: any, res: any) => {
    try {
        const { studentIds, status } = req.body; // status: 'ACTIVE' | 'SUSPENDED'
        if (!studentIds || !Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds required' });
        const prisma = (await import('../lib/prisma.js')).default;
        for (const id of studentIds) {
            await prisma.user.update({ where: { id }, data: { status } });
        }
        res.json({ success: true, count: studentIds.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ── Import students from CSV only (columns: name,email,department,nationalId) ──
export const importStudents = async (req: any, res: any) => {
    try {
        const file = req.file;
        const yearGroup = (req.body.yearGroup || req.query.yearGroup || 'Junior') as string;
        if (!file || !file.buffer) return res.status(400).json({ error: 'File required' });

        const buf = file.buffer;
        const fname = (file.originalname || '').toLowerCase();
        let text: string;
        if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
            try {
                const XLSX = (await import('xlsx')).default;
                const wb = XLSX.read(buf, { type: 'buffer' });
                const firstSheet = wb.SheetNames[0];
                if (!firstSheet) return res.status(400).json({ error: 'Excel file has no sheets.' });
                const ws = wb.Sheets[firstSheet];
                const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
                text = (data as any[][]).map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c ?? '')) : Object.values(r || {})).join(',')).join('\n');
            } catch (ex: any) {
                return res.status(400).json({ error: 'Could not parse Excel. Please save as CSV (File > Save As > CSV) or use the template.' });
            }
        } else {
            text = buf.toString('utf-8');
        }
        const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
        const rows: { name: string; email: string; department: string; nationalId?: string }[] = [];
        const isHeader = (parts: string[]) => {
            const first = (parts[0] || '').toLowerCase();
            const second = (parts[1] || '').toLowerCase();
            return first === 'name' || first.includes('email') || second === 'email' || first === 'full name';
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map((p: string) => p.trim().replace(/^["']|["']$/g, ''));
            if (parts.length < 3) continue;
            if (i === 0 && isHeader(parts)) continue;
            const name = parts[0] || '';
            const email = parts[1] || '';
            const department = parts[2] || '';
            const nationalId = parts[3] || undefined;
            if (!name || !email || !email.includes('@')) continue;
            rows.push({ name, email, department, nationalId });
        }

        res.json({ rows, yearGroup });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ── Enroll imported students into system and send credentials ──
export const enrollStudents = async (req: any, res: any) => {
    try {
        const { students: rows, yearGroup } = req.body;
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'students array required' });
        }

        const prisma = (await import('../lib/prisma.js')).default;
        const bcrypt = (await import('bcryptjs')).default;
        const crypto = (await import('crypto')).default;
        const { EmailService } = await import('../services/emailService.js');

        const yearRecord = await prisma.academicYear.findFirst({
            where: { name: { contains: yearGroup } },
        });
        if (!yearRecord) {
            return res.status(400).json({ error: `Academic year "${yearGroup}" not found` });
        }

        const created: { name: string; email: string }[] = [];
        const failed: { name: string; email: string; reason: string }[] = [];

        for (const row of rows) {
            const { name, email, department, nationalId } = row;
            if (!name || !email) {
                failed.push({ name: name || '', email: email || '', reason: 'Missing name or email' });
                continue;
            }

            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                failed.push({ name, email, reason: 'Email already exists' });
                continue;
            }

            const password = crypto.randomBytes(6).toString('hex');
            const hashedPassword = await bcrypt.hash(password, 10);

            let departmentId: string | null = null;
            if (department) {
                const dept = await prisma.department.findFirst({
                    where: { name: { contains: department } },
                });
                departmentId = dept?.id || null;
            }

            await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: 'STUDENT',
                    status: 'ACTIVE',
                    nationalId: nationalId || null,
                    academicYearId: yearRecord.id,
                    admissionYear: yearRecord.name,
                    departmentId,
                },
            });

            await EmailService.sendCredentials(email, name, password);
            created.push({ name, email });
        }

        res.json({ success: true, created: created.length, failed, createdList: created });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
