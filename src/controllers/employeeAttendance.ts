import type { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function timeStrToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function dateTimeToMinutes(dt: Date) {
    return dt.getHours() * 60 + dt.getMinutes();
}

async function getSettings() {
    let settings = await (prisma as any).attendanceSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
        settings = await (prisma as any).attendanceSettings.create({ data: { id: 1 } });
    }
    return settings;
}

async function getSchedule() {
    let schedule = await (prisma as any).weeklySchedule.findUnique({ where: { id: 1 } });
    if (!schedule) {
        schedule = await (prisma as any).weeklySchedule.create({ data: { id: 1 } });
    }
    return schedule;
}

async function isWorkingDay(date: Date) {
    const schedule = await getSchedule();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[date.getDay()];
    return (schedule as any)[dayName] === true;
}

async function isHoliday(dateStr: string) {
    const holiday = await (prisma as any).publicHoliday.findUnique({ where: { date: dateStr } });
    return !!holiday;
}

// ── Check-In ─────────────────────────────────────────────────────────────────

export const myCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const now = new Date();
        const dateStr = todayStr();
        const settings = await getSettings();

        // Reject before check_in_open
        const openMinutes = timeStrToMinutes(settings.checkInOpen);
        const nowMinutes = dateTimeToMinutes(now);
        if (nowMinutes < openMinutes) {
            return res.status(400).json({ error: `Check-in not open until ${settings.checkInOpen}` });
        }

        // Prevent check-in on non-working day
        if (!(await isWorkingDay(now))) {
            return res.status(400).json({ error: 'Today is not a working day' });
        }

        // Prevent check-in on public holiday
        if (await isHoliday(dateStr)) {
            return res.status(400).json({ error: 'Today is a public holiday' });
        }

        // Prevent duplicate
        const existing = await (prisma as any).employeeAttendance.findUnique({
            where: { employeeId_date: { employeeId: userId, date: dateStr } }
        });
        if (existing && existing.checkInTime) {
            return res.status(400).json({ error: 'Already checked in today' });
        }

        // Determine status
        const lateMinutes = timeStrToMinutes(settings.lateAfter);
        const status = (settings.lockLate || nowMinutes > lateMinutes) ? 'Late' : 'Present';

        const record = await (prisma as any).employeeAttendance.upsert({
            where: { employeeId_date: { employeeId: userId, date: dateStr } },
            update: { checkInTime: now, status },
            create: { employeeId: userId, date: dateStr, checkInTime: now, status }
        });

        res.status(201).json(record);
    } catch (error) {
        next(error);
    }
};

// ── Check-Out ────────────────────────────────────────────────────────────────

export const myCheckOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const now = new Date();
        const dateStr = todayStr();
        const settings = await getSettings();

        const existing = await (prisma as any).employeeAttendance.findUnique({
            where: { employeeId_date: { employeeId: userId, date: dateStr } }
        });
        if (!existing) return res.status(400).json({ error: 'No check-in record for today' });
        if (existing.checkOutTime) return res.status(400).json({ error: 'Already checked out today' });

        // Calculate overtime
        const configuredOut = timeStrToMinutes(settings.checkOutTime);
        const nowMinutes = dateTimeToMinutes(now);
        const overtimeHours = Math.max(0, (nowMinutes - configuredOut) / 60);

        const record = await (prisma as any).employeeAttendance.update({
            where: { employeeId_date: { employeeId: userId, date: dateStr } },
            data: { checkOutTime: now, overtimeHours }
        });

        res.json(record);
    } catch (error) {
        next(error);
    }
};

// ── QR Check-In ──────────────────────────────────────────────────────────────

export const qrCheckIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { qrData, lat, lng } = req.body;
        if (!qrData) return res.status(400).json({ error: 'qrData required' });

        // Decode qrData: expected base64 JSON { employeeId }
        let employeeId: string;
        try {
            const decoded = Buffer.from(qrData, 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded);
            employeeId = parsed.employeeId;
        } catch {
            return res.status(400).json({ error: 'Invalid QR data format' });
        }

        if (!employeeId) return res.status(400).json({ error: 'Employee ID not found in QR data' });

        const now = new Date();
        const dateStr = todayStr();
        const settings = await getSettings();

        const openMinutes = timeStrToMinutes(settings.checkInOpen);
        const nowMinutes = dateTimeToMinutes(now);
        if (nowMinutes < openMinutes) {
            return res.status(400).json({ error: `Check-in not open until ${settings.checkInOpen}` });
        }

        if (!(await isWorkingDay(now))) return res.status(400).json({ error: 'Not a working day' });
        if (await isHoliday(dateStr)) return res.status(400).json({ error: 'Public holiday' });

        const existing = await (prisma as any).employeeAttendance.findUnique({
            where: { employeeId_date: { employeeId, date: dateStr } }
        });
        if (existing?.checkInTime) return res.status(400).json({ error: 'Already checked in' });

        const lateMinutes = timeStrToMinutes(settings.lateAfter);
        const status = (settings.lockLate || nowMinutes > lateMinutes) ? 'Late' : 'Present';

        const record = await (prisma as any).employeeAttendance.upsert({
            where: { employeeId_date: { employeeId, date: dateStr } },
            update: { checkInTime: now, status },
            create: { employeeId, date: dateStr, checkInTime: now, status }
        });

        res.status(201).json(record);
    } catch (error) {
        next(error);
    }
};

// ── Lock Late Now ────────────────────────────────────────────────────────────

export const markLateNow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await (prisma as any).attendanceSettings.update({
            where: { id: 1 },
            data: { lockLate: true }
        });
        res.json({ message: 'Check-in locked — all future check-ins will be marked Late', settings });
    } catch (error) {
        next(error);
    }
};

// ── Auto Checkout ────────────────────────────────────────────────────────────

export const autoCheckout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateStr = todayStr();
        const settings = await getSettings();
        const now = new Date();

        const missing = await (prisma as any).employeeAttendance.findMany({
            where: { date: dateStr, checkInTime: { not: null }, checkOutTime: null }
        });

        const configuredOut = timeStrToMinutes(settings.checkOutTime);
        const nowMinutes = dateTimeToMinutes(now);
        const overtimeHours = Math.max(0, (nowMinutes - configuredOut) / 60);

        for (const record of missing) {
            await (prisma as any).employeeAttendance.update({
                where: { id: record.id },
                data: { checkOutTime: now, overtimeHours }
            });
        }

        res.json({ message: `Auto-checked out ${missing.length} employees`, count: missing.length });
    } catch (error) {
        next(error);
    }
};

// ── Process Day ──────────────────────────────────────────────────────────────

export const processDay = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateStr = (req.body.date as string) || todayStr();
        const settings = await getSettings();
        const now = new Date();

        const result = await (prisma as any).$transaction(async (tx: any) => {
            // 1. Auto-checkout users without checkout
            const noCheckout = await tx.employeeAttendance.findMany({
                where: { date: dateStr, checkInTime: { not: null }, checkOutTime: null }
            });
            const configuredOut = timeStrToMinutes(settings.checkOutTime);
            const nowMinutes = dateTimeToMinutes(now);
            const overtimeHours = Math.max(0, (nowMinutes - configuredOut) / 60);

            for (const r of noCheckout) {
                await tx.employeeAttendance.update({
                    where: { id: r.id },
                    data: { checkOutTime: now, overtimeHours }
                });
            }

            // 2. Mark absent for employees without any record
            const allEmployees = await tx.user.findMany({
                where: { role: { in: ['ADMIN', 'STAFF'] }, status: 'ACTIVE' },
                select: { id: true }
            });

            const existingRecords = await tx.employeeAttendance.findMany({
                where: { date: dateStr },
                select: { employeeId: true }
            });
            const checkedIds = new Set(existingRecords.map((r: any) => r.employeeId));

            let absentMarked = 0;
            for (const emp of allEmployees) {
                if (!checkedIds.has(emp.id)) {
                    await tx.employeeAttendance.create({
                        data: { employeeId: emp.id, date: dateStr, status: 'Absent' }
                    });
                    absentMarked++;
                }
            }

            // 3. Fetch all records for summary
            const allRecords = await tx.employeeAttendance.findMany({ where: { date: dateStr } });
            const presentCount = allRecords.filter((r: any) => r.status === 'Present').length;
            const lateCount = allRecords.filter((r: any) => r.status === 'Late').length;
            const absentCount = allRecords.filter((r: any) => r.status === 'Absent').length;
            const totalOvertimeHours = allRecords.reduce((sum: number, r: any) => sum + (r.overtimeHours || 0), 0);

            return {
                totalRecords: allRecords.length,
                presentCount,
                lateCount,
                absentCount,
                totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
            };
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ── Settings CRUD ────────────────────────────────────────────────────────────

export const getAttendanceSettings = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await getSettings();
        const schedule = await getSchedule();
        const holidays = await (prisma as any).publicHoliday.findMany({ orderBy: { date: 'asc' } });
        res.json({ settings, schedule, holidays });
    } catch (error) {
        next(error);
    }
};

export const updateAttendanceSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { checkInOpen, lateAfter, checkOutTime, overtimeRate } = req.body;
        const settings = await (prisma as any).attendanceSettings.upsert({
            where: { id: 1 },
            update: { checkInOpen, lateAfter, checkOutTime, overtimeRate: parseFloat(overtimeRate) },
            create: { id: 1, checkInOpen, lateAfter, checkOutTime, overtimeRate: parseFloat(overtimeRate) }
        });
        res.json(settings);
    } catch (error) {
        next(error);
    }
};

export const updateWeeklySchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;
        const schedule = await (prisma as any).weeklySchedule.upsert({
            where: { id: 1 },
            update: { monday, tuesday, wednesday, thursday, friday, saturday, sunday },
            create: { id: 1, monday, tuesday, wednesday, thursday, friday, saturday, sunday }
        });
        res.json(schedule);
    } catch (error) {
        next(error);
    }
};

export const addPublicHoliday = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { date, name } = req.body;
        const holiday = await (prisma as any).publicHoliday.create({ data: { date, name } });
        res.status(201).json(holiday);
    } catch (error) {
        next(error);
    }
};

export const deletePublicHoliday = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await (prisma as any).publicHoliday.delete({ where: { id: req.params.id } });
        res.json({ message: 'Holiday deleted' });
    } catch (error) {
        next(error);
    }
};

// ── My Attendance ────────────────────────────────────────────────────────────

export const getMyEmployeeAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const records = await (prisma as any).employeeAttendance.findMany({
            where: { employeeId: userId },
            orderBy: { date: 'desc' },
            take: 60
        });
        res.json(records);
    } catch (error) {
        next(error);
    }
};

// ── Admin: All Records ───────────────────────────────────────────────────────

export const getAllEmployeeAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { date, employeeId } = req.query;
        const where: any = {};
        if (date) where.date = date;
        if (employeeId) where.employeeId = employeeId;

        const records = await (prisma as any).employeeAttendance.findMany({
            where,
            include: { employee: { select: { id: true, name: true, email: true, role: true } } },
            orderBy: [{ date: 'desc' }, { checkInTime: 'asc' }],
        });        res.json(records);
    } catch (error) {
        next(error);
    }
};
