import type { Request, Response } from 'express';
import { SystemService } from '../services/systemService.js';
import { AuditService } from '../services/auditService.js';
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

export const defaultSettings = {
    branding: { logoUrl: '', primaryColor: '#FFC600', secondaryColor: '#000000' },
    policies: { attendanceThreshold: 75, delinquencyLockDays: 30 },
    academicYear: '2024/2025',
    minAdmissionScore: 0,
    allowOnlineAdmissions: true,
    enableStudentFeed: true,
    smtpHost: '',
    smtpSender: '',
};
export const getDashboardKPIs = async (req: Request, res: Response) => {
    try {
        const kpis = await SystemService.getKPIs();
        res.json(kpis);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching KPIs', error: error.message });
    }
};

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const userId = (req.query.userId as string) || undefined;
        const logs = await prisma.auditLog.findMany({
            where: userId ? { userId } : {},
            include: {
                user: {
                    select: { name: true, id: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        // Map logs to format expected by frontend
        const formattedLogs = logs.map((log: any) => ({
            ...log,
            userName: log.user?.name || 'System',
            module: log.action.includes('USER') ? 'Users' :
                log.action.includes('DEPT') ? 'Departments' :
                    log.action.includes('FINANCE') ? 'Finances' :
                        log.action.includes('PASSWORD') ? 'Security' : 'General',
            timestamp: log.createdAt.toISOString(),
            ipAddress: log.ipAddress || '127.0.0.1'
        }));

        console.log(`[AUDIT] Returning ${formattedLogs.length} logs to frontend`);
        res.json(formattedLogs);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
};

export const getPublicBranding = async (_req: Request, res: Response) => {
    try {
        let settings: any = { branding: defaultSettings.branding };
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
            settings.branding = raw.branding || defaultSettings.branding;
        }
        res.json(settings.branding);
    } catch {
        res.json(defaultSettings.branding);
    }
};

export const getSystemSettings = async (req: Request, res: Response) => {
    try {
        let settings: any = {};
        if (fs.existsSync(SETTINGS_FILE)) {
            settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        } else {
            settings = { ...defaultSettings };
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        }

        // Merge with SchoolInfo from DB
        const schoolInfo = await prisma.schoolInfo.findFirst();
        settings.minAdmissionScore = schoolInfo?.minAdmissionScore || 0;

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: 'Error reading settings', error: error.message });
    }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
    try {
        const { minAdmissionScore, ...jsonSettings } = req.body;

        // Update JSON settings
        let current = { ...defaultSettings };
        if (fs.existsSync(SETTINGS_FILE)) {
            current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
        const updated = { ...current, ...jsonSettings };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));

        // Update DB settings if provided
        if (minAdmissionScore !== undefined) {
            const schoolInfo = await prisma.schoolInfo.findFirst();
            if (schoolInfo) {
                await prisma.schoolInfo.update({
                    where: { id: schoolInfo.id },
                    data: { minAdmissionScore: parseFloat(minAdmissionScore) }
                });
            } else {
                // If no school info exists, create one (should not happen with seed)
                await prisma.schoolInfo.create({
                    data: {
                        name: 'SASMS',
                        minAdmissionScore: parseFloat(minAdmissionScore)
                    }
                });
            }
            updated.minAdmissionScore = minAdmissionScore;
        }

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating settings', error: error.message });
    }
};

export const uploadSystemLogo = async (req: Request, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: 'No logo file uploaded' });
        const logoPath = 'uploads/' + file.filename;

        let current: any = { ...defaultSettings };
        if (fs.existsSync(SETTINGS_FILE)) {
            current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
        const updated = {
            ...current,
            branding: { ...(current.branding || {}), logoUrl: logoPath }
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
        res.json({ logoUrl: logoPath, settings: updated });
    } catch (error: any) {
        res.status(500).json({ message: 'Error uploading logo', error: error.message });
    }
};

export const resetSystemSettings = async (_req: Request, res: Response) => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
        const schoolInfo = await prisma.schoolInfo.findFirst();
        if (schoolInfo) {
            await prisma.schoolInfo.update({
                where: { id: schoolInfo.id },
                data: { minAdmissionScore: defaultSettings.minAdmissionScore }
            });
        }
        res.json({ message: 'Settings reset to default', settings: defaultSettings });
    } catch (error: any) {
        res.status(500).json({ message: 'Error resetting settings', error: error.message });
    }
};

// ─── Custom Form Fields (stored in JSON file, shared across all users) ─────────
const FORM_FIELDS_FILE = path.join(process.cwd(), 'custom_form_fields.json');

export const getCustomFormFields = async (_req: Request, res: Response) => {
    try {
        if (fs.existsSync(FORM_FIELDS_FILE)) {
            res.json(JSON.parse(fs.readFileSync(FORM_FIELDS_FILE, 'utf-8')));
        } else {
            res.json([]);
        }
    } catch { res.json([]); }
};

export const saveCustomFormFields = async (req: Request, res: Response) => {
    try {
        const fields = req.body; // array of FormField
        fs.writeFileSync(FORM_FIELDS_FILE, JSON.stringify(fields, null, 2));
        res.json({ success: true, fields });
    } catch (error: any) {
        res.status(500).json({ message: 'Error saving form fields', error: error.message });
    }
};

// ─── Teacher of the Month (homepage spotlight, JSON-backed) ────────────────────

const TEACHER_FILE = path.join(process.cwd(), 'teacher_of_month.json');

export const getTeacherOfMonth = async (_req: Request, res: Response) => {
    try {
        if (fs.existsSync(TEACHER_FILE)) {
            const raw = fs.readFileSync(TEACHER_FILE, 'utf-8');
            return res.json(JSON.parse(raw));
        }
    } catch { /* ignore and fall back */ }
    // Default placeholder
    return res.json({
        name: 'Teacher of the Month',
        title: 'Outstanding Educator',
        imageUrl: '',
        quote: 'Inspiring excellence in every classroom.',
        month: '',
        year: '',
        imageOffsetX: 0,
        imageOffsetY: 0,
    });
};

export const setTeacherOfMonth = async (req: Request, res: Response) => {
    try {
        const { name, title, imageUrl, quote, month, year, imageOffsetX, imageOffsetY } = req.body;
        const payload = {
            name: name || 'Teacher of the Month',
            title: title || '',
            imageUrl: imageUrl || '',
            quote: quote || '',
            month: month || '',
            year: year || '',
            imageOffsetX: typeof imageOffsetX === 'number' ? imageOffsetX : parseFloat(imageOffsetX ?? '0') || 0,
            imageOffsetY: typeof imageOffsetY === 'number' ? imageOffsetY : parseFloat(imageOffsetY ?? '0') || 0,
        };
        fs.writeFileSync(TEACHER_FILE, JSON.stringify(payload, null, 2));
        res.json(payload);
    } catch (error: any) {
        res.status(500).json({ message: 'Error saving teacher of the month', error: error.message });
    }
};

export const downloadTeacherOfMonthPdf = async (_req: Request, res: Response) => {
    try {
        let data: any = {
            name: 'Teacher of the Month',
            title: 'Outstanding Educator',
            quote: 'Inspiring excellence in every classroom.',
            month: '',
            year: '',
        };

        if (fs.existsSync(TEACHER_FILE)) {
            const raw = fs.readFileSync(TEACHER_FILE, 'utf-8');
            data = { ...data, ...(JSON.parse(raw) || {}) };
        }

        // Try to resolve a local image path if the image was uploaded via our backend
        let teacherImagePath: string | null = null;
        if (data.imageUrl && typeof data.imageUrl === 'string') {
            let candidate = data.imageUrl as string;
            if (candidate.startsWith('http')) {
                // For remote URLs we skip embedding to avoid network/format issues in the PDF generator.
                candidate = '';
            }
            if (candidate) {
                const joined = path.join(process.cwd(), candidate);
                if (fs.existsSync(joined)) {
                    teacherImagePath = joined;
                }
            }
        }

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="teacher-of-month.pdf"');

        doc.pipe(res);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // Background – bold gradient with subtle pattern
        const gradientHeight = pageHeight;
        doc
            .rect(0, 0, pageWidth, gradientHeight)
            .fill('#FFC600');

        // White spotlight card
        const cardX = 40;
        const cardY = 70;
        const cardW = pageWidth - 80;
        const cardH = pageHeight - 120;

        doc
            .roundedRect(cardX, cardY, cardW, cardH, 24)
            .fillOpacity(1)
            .fill('#ffffff');

        // Decorative accent bar at top of card
        doc
            .save()
            .rect(cardX, cardY, cardW, 12)
            .fill('#111827')
            .restore();

        // Header inside card
        const innerPadding = 40;
        const headerY = cardY + innerPadding;
        doc.fillColor('#111827');
        doc.fontSize(24).font('Helvetica-Bold').text('SASMS', cardX + innerPadding, headerY);
        const monthLabel = data.month || 'Month';
        const yearLabel = data.year || new Date().getFullYear().toString();
        doc.fontSize(14).font('Helvetica-Bold').text(`${monthLabel} ${yearLabel}`, cardX + cardW - innerPadding - 160, headerY + 4, {
            width: 160,
            align: 'right',
        });

        // Main title
        const titleY = headerY + 40;
        doc.fontSize(40).font('Helvetica-Bold').fillColor('#111827').text('Congratulations !', cardX + innerPadding, titleY);
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#4b5563').text('Teacher of the Month', cardX + innerPadding, titleY + 42);

        // Layout: left circle photo, right text
        const contentTop = titleY + 90;
        const photoCenterX = cardX + innerPadding + 120;
        const photoCenterY = contentTop + 80;
        const photoRadius = 90;

        if (teacherImagePath) {
            // Circular clipped photo with ring
            doc.save();
            doc.circle(photoCenterX, photoCenterY, photoRadius).clip();
            doc.image(teacherImagePath, photoCenterX - photoRadius, photoCenterY - photoRadius, {
                width: photoRadius * 2,
                height: photoRadius * 2,
                fit: [photoRadius * 2, photoRadius * 2],
                align: 'center',
                valign: 'center',
            });
            doc.restore();

            // Outer ring
            doc.save();
            doc.circle(photoCenterX, photoCenterY, photoRadius + 4).lineWidth(3).stroke('#111827');
            doc.circle(photoCenterX, photoCenterY, photoRadius - 6).lineWidth(2).stroke('#FACC15');
            doc.restore();
        } else {
            // Fallback badge if no image
            doc.save();
            doc.circle(photoCenterX, photoCenterY, photoRadius).lineWidth(4).stroke('#111827');
            doc.circle(photoCenterX, photoCenterY, photoRadius - 10).lineWidth(3).stroke('#FACC15');
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827').text(
                'Teacher\nof the\nMonth',
                photoCenterX - 60,
                photoCenterY - 40,
                { width: 120, align: 'center' }
            );
            doc.restore();
        }

        // Right-hand text block
        const textBlockX = photoCenterX + photoRadius + 40;
        const textBlockWidth = cardX + cardW - innerPadding - textBlockX;

        // Name + title
        doc.fontSize(26).font('Helvetica-Bold').fillColor('#111827').text(data.name || 'Teacher Name', textBlockX, contentTop, {
            width: textBlockWidth,
        });
        if (data.title) {
            doc.fontSize(18).font('Helvetica').fillColor('#4b5563').text(data.title, textBlockX, contentTop + 32, {
                width: textBlockWidth,
            });
        }

        // Quote
        if (data.quote) {
            doc.fontSize(14).font('Helvetica-Oblique').fillColor('#374151').text(`"${data.quote}"`, textBlockX, contentTop + 70, {
                width: textBlockWidth,
                align: 'left',
            });
        }

        // Footer tagline
        const footerY = cardY + cardH - innerPadding - 20;
        doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#9CA3AF')
            .text('Generated by SASMS Digital School Platform', cardX + innerPadding, footerY);

        doc.end();
    } catch (error: any) {
        console.error('Error generating teacher-of-month PDF', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating teacher of the month PDF', error: error.message });
        }
    }
};
