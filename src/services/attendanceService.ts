import prisma from '../lib/prisma.js';
import QRCode from 'qrcode';

export class AttendanceService {
    static async createSession(data: any, adminId: string) {
        const { title, latitude, longitude, radius, startTime, endTime, lateAfter } = data;
        return (prisma as any).attendanceSession.create({
            data: {
                title,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                radius: parseFloat(radius),
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                lateAfter: lateAfter ? new Date(lateAfter) : null,
                createdBy: adminId
            }
        });
    }

    static async validateScan(userId: string, data: any) {
        const { sessionId, studentLatitude, studentLongitude } = data;
        const currentTime = new Date();

        // 1. Verify session exists
        const session = await (prisma as any).attendanceSession.findUnique({
            where: { id: sessionId }
        });
        if (!session) throw new Error('Session not found');

        // 2. Verify time window
        if (currentTime < session.startTime) {
            return { success: false, reason: 'NOT_STARTED', message: 'Attendance session has not started yet' };
        }
        if (currentTime > session.endTime) {
            return { success: false, reason: 'ENDED', message: 'Attendance session has ended' };
        }

        // 3. Prevent duplicate scans (but allow overwriting ABSENT status)
        const existing = await (prisma as any).attendanceRecord.findUnique({
            where: {
                studentId_sessionId: {
                    studentId: userId,
                    sessionId
                }
            }
        });

        if (existing && (existing.status === 'PRESENT' || existing.status === 'LATE')) {
            throw new Error('Attendance already recorded');
        }

        // 4. Calculate distance
        const distance = this.calculateDistance(
            session.latitude,
            session.longitude,
            parseFloat(studentLatitude),
            parseFloat(studentLongitude)
        );

        // 5. Determine status
        let status = 'ABSENT';
        if (distance <= session.radius) {
            status = session.lateAfter && currentTime > session.lateAfter ? 'LATE' : 'PRESENT';
        }

        // 6. Record attendance
        return (prisma as any).attendanceRecord.upsert({
            where: {
                studentId_sessionId: {
                    studentId: userId,
                    sessionId
                }
            },
            update: {
                status,
                distance,
                studentLatitude: parseFloat(studentLatitude),
                studentLongitude: parseFloat(studentLongitude),
                scannedAt: currentTime
            },
            create: {
                studentId: userId,
                sessionId,
                status,
                distance,
                studentLatitude: parseFloat(studentLatitude),
                studentLongitude: parseFloat(studentLongitude),
                scannedAt: currentTime
            }
        });
    }

    private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // In meters
    }

    static async autoMarkAbsent(sessionId: string) {
        const session = await (prisma as any).attendanceSession.findUnique({
            where: { id: sessionId },
            include: { records: true }
        });
        if (!session) return;

        // Get all students
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' }
        });

        const recordedStudentIds = new Set(session.records.map((r: any) => r.studentId));
        const missingStudents = students.filter(s => !recordedStudentIds.has(s.id));

        if (missingStudents.length > 0) {
            await (prisma as any).attendanceRecord.createMany({
                data: missingStudents.map(s => ({
                    studentId: s.id,
                    sessionId,
                    status: 'ABSENT'
                }))
            });
        }
    }

    static async getSessionReport(sessionId: string) {
        return (prisma as any).attendanceSession.findUnique({
            where: { id: sessionId },
            include: {
                records: {
                    include: { student: { select: { name: true, email: true } } }
                }
            }
        });
    }

    static async getAllSessions() {
        return (prisma as any).attendanceSession.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { records: true }
                }
            }
        });
    }

    static async generateQR(sessionId: string) {
        // The domain should ideally come from an environment variable
        const domain = process.env.APP_URL || 'https://yourdomain.com';
        const url = `${domain}/student/scan?sessionId=${sessionId}`;
        return QRCode.toDataURL(url);
    }

    static async getMyAttendance(userId: string) {
        const records = await (prisma as any).attendanceRecord.findMany({
            where: { studentId: userId },
            include: {
                session: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const totalDays = records.length;
        const presentDays = records.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const absentDays = records.filter((r: any) => r.status === 'ABSENT').length;
        const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

        return {
            records: records.map((r: any) => ({
                id: r.id,
                session: r.session ? { title: r.session.title } : null,
                scannedAt: r.scannedAt || r.createdAt,
                status: r.status,
                distance: r.distance ?? null,
                date: r.session?.startTime || r.createdAt,
                notes: r.distance ? `Scanned within ${r.distance.toFixed(1)}m` : 'Marked by Administrator'
            })),
            summary: {
                totalDays,
                presentDays,
                absentDays,
                percentage: parseFloat(percentage.toFixed(1))
            }
        };
    }
}
