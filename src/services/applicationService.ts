import prisma from '../lib/prisma.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { AuditService } from './auditService.js';
import { EmailService } from './emailService.js';

export class ApplicationService {
    static async submit(applicantId: string, data: any, files: any) {
        const { nationalId, preferredDeptId, selectionReason, ministryScore, phoneNumber, customFieldsData } = data;
        const score = parseFloat(ministryScore);

        logger.info(`Submitting application for applicant ${applicantId}`);

        const birthCertificateUrl = files?.['birthCertificate']?.[0]?.filename;
        const idCardUrl = files?.['idCard']?.[0]?.filename;
        const ministryResultUrl = files?.['ministryResult']?.[0]?.filename;
        const receiptUrl = files?.['receipt']?.[0]?.filename;
        const otherDocsUrls = Array.isArray(files?.['otherDocs'])
            ? files['otherDocs'].map((f: any) => f.filename)
            : [];

        // Auto-rejection logic
        const schoolInfo = await prisma.schoolInfo.findFirst();
        const minScore = schoolInfo?.minAdmissionScore || 0;

        let status = 'PENDING';
        let feedback = null;
        if (!isNaN(score) && score < minScore) {
            status = 'REJECTED';
            feedback = `Auto-rejected: Ministry score (${score}%) is below the minimum required (${minScore}%).`;
        }

        // Optional phone update
        if (phoneNumber) {
            await prisma.user.update({
                where: { id: applicantId },
                data: { phoneNumber }
            });
        }

        return await prisma.application.upsert({
            where: { applicantId },
            update: {
                nationalId,
                preferredDeptId,
                selectionReason,
                ministryScore: isNaN(score) ? null : score,
                ...(birthCertificateUrl && { birthCertificateUrl }),
                ...(idCardUrl && { idCardUrl }),
                ...(ministryResultUrl && { ministryResultUrl }),
                ...(receiptUrl && { receiptUrl }),
                ...(otherDocsUrls.length > 0 && { otherDocsUrls: JSON.stringify(otherDocsUrls) }),
                customFieldsData: customFieldsData || null,
                status,
                feedback: status === 'REJECTED' ? feedback : null
            },
            create: {
                applicantId,
                nationalId,
                preferredDeptId,
                selectionReason,
                ministryScore: isNaN(score) ? null : score,
                birthCertificateUrl,
                idCardUrl,
                ministryResultUrl,
                receiptUrl,
                otherDocsUrls: otherDocsUrls.length > 0 ? JSON.stringify(otherDocsUrls) : null,
                customFieldsData: customFieldsData || null,
                status,
                feedback: status === 'REJECTED' ? feedback : null
            }
        });
    }

    static async getAll() {
        const apps = await prisma.application.findMany({
            include: {
                applicant: {
                    select: { name: true, email: true, role: true, phoneNumber: true }
                },
                preferredDept: true
            }
        });
        
        return apps.map((a: any) => ({
            ...a,
            name: a.applicant.name,
            email: a.applicant.email,
            phone: a.applicant.phoneNumber,
            department: a.preferredDept?.name
        }));
    }

    static async getByApplicantId(applicantId: string) {
        const application = await prisma.application.findUnique({
            where: { applicantId },
            include: { 
                preferredDept: true,
                applicant: {
                    select: { name: true, email: true, phoneNumber: true }
                }
            }
        });

        if (!application) {
            return null;
        }

        return application;
    }

    static async review(id: string, reviewerId: string, status: any, feedback: any) {
        const data: any = {};
        if (status) data.status = status;
        if (feedback !== undefined) data.feedback = feedback;
        if (reviewerId) data.reviewerId = reviewerId;

        const application = await prisma.application.findUnique({
            where: { id },
            include: { applicant: true }
        });

        if (!application) throw new APIError(404, 'Application not found');

        const updated = await prisma.application.update({
            where: { id },
            data,
            include: { preferredDept: true }
        });

        // Log decision
        await prisma.admissionDecisionLog.create({
            data: {
                applicationId: id,
                adminId: reviewerId,
                statusAfter: status || application.status,
                notes: feedback
            }
        });

        // Email notification based on status
        if (application.applicant.email) {
            let emailSubject = 'Update on your Application - SASMS';
            let emailBody = '';

            if (status === 'EXAM_SCHEDULED') {
                emailSubject = '📋 Entrance Exam Scheduled - SASMS Admissions';
                emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1976d2;">Entrance Exam Scheduled</h2>
                    <p>Dear ${application.applicant.name},</p>
                    <p>Congratulations! Your application has passed the initial review. You are invited to take our entrance exam.</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3>Exam Details:</h3>
                        <p><strong>📅 Date & Time:</strong> ${(updated as any).examDate || 'TBD'}</p>
                        <p><strong>📍 Location:</strong> ${(updated as any).examLocation || 'TBD'}</p>
                        ${(updated as any).examNotes ? `<p><strong>📝 Notes:</strong> ${(updated as any).examNotes}</p>` : ''}
                    </div>
                    <p>Please log in to the portal to view full details. Make sure to arrive 30 minutes early.</p>
                    </div>
                `;
            } else if (status === 'INTERVIEW_SCHEDULED') {
                emailSubject = '🎉 Interview Invitation - SASMS Admissions';
                emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #388e3c;">Personal Interview Scheduled</h2>
                    <p>Dear ${application.applicant.name},</p>
                    <p>Excellent news! You have successfully passed the entrance exam and are invited for a personal interview.</p>
                    <div style="background: #f1f8e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3>Interview Details:</h3>
                        <p><strong>📅 Date & Time:</strong> ${(updated as any).interviewDate || 'TBD'}</p>
                        <p><strong>📍 Location:</strong> ${(updated as any).interviewLocation || 'TBD'}</p>
                        ${(updated as any).interviewNotes ? `<p><strong>📝 Notes:</strong> ${(updated as any).interviewNotes}</p>` : ''}
                    </div>
                    <p>Please log in to the portal to view full details. Dress professionally and bring your original documents.</p>
                    </div>
                `;
            } else if (status === 'ACCEPTED') {
                emailSubject = '🎓 Congratulations! Application Accepted - SASMS';
                emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #388e3c;">Application Accepted!</h2>
                    <p>Dear ${application.applicant.name},</p>
                    <p>We are delighted to inform you that your application to SASMS has been <strong>ACCEPTED</strong>!</p>
                    <p>Please log in to the portal to complete your enrollment as a student.</p>
                    ${feedback ? `<p><strong>Admin Note:</strong> ${feedback}</p>` : ''}
                    </div>
                `;
            } else if (status === 'REJECTED') {
                emailSubject = 'Application Status Update - SASMS';
                emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d32f2f;">Application Status Update</h2>
                    <p>Dear ${application.applicant.name},</p>
                    <p>After careful consideration, we regret to inform you that your application has not been approved at this time.</p>
                    ${feedback ? `<p><strong>Reason:</strong> ${feedback}</p>` : ''}
                    <p>We wish you the best in your future endeavors.</p>
                    </div>
                `;
            } else if (feedback) {
                emailBody = `<p>Hello ${application.applicant.name},</p><p>An admin has added a note to your application:</p><blockquote>${feedback}</blockquote><p>Please log in to the portal for more details.</p>`;
            }

            if (emailBody) {
                await EmailService.sendMail(application.applicant.email, emailSubject, emailBody);
            }
        }

        // Create in-app notification for the applicant
        if (status && ['EXAM_SCHEDULED', 'INTERVIEW_SCHEDULED', 'ACCEPTED', 'REJECTED'].includes(status)) {
            const notifMessages: Record<string, string> = {
                EXAM_SCHEDULED: '📋 Your entrance exam has been scheduled! Check your dashboard for details.',
                INTERVIEW_SCHEDULED: '🎉 You passed the exam! Your interview has been scheduled.',
                ACCEPTED: '🎓 Congratulations! Your application has been accepted!',
                REJECTED: 'Your application status has been updated. Please check your dashboard.'
            };

            await prisma.notification.create({
                data: {
                    text: notifMessages[status],
                    type: status === 'ACCEPTED' ? 'success' : status === 'REJECTED' ? 'error' : 'info',
                    userId: application.applicantId,
                    link: '/applicant/dashboard'
                }
            });
        }

        // Notify Super Admin on decision
        if (status === 'ACCEPTED' || status === 'REJECTED') {
            await prisma.notification.create({
                data: {
                    text: `Admin ${status === 'ACCEPTED' ? 'accepted' : 'rejected'} student: ${application.applicant.name}. Dept: ${updated.preferredDept?.name || 'N/A'}, Score: ${application.ministryScore || 'N/A'}%`,
                    type: status === 'ACCEPTED' ? 'success' : 'error',
                    targetRole: 'SUPER_ADMIN',
                    link: '/superadmin/admissions'
                }
            });
        }

        await AuditService.logAction('REVIEW_APPLICATION', reviewerId, { applicationId: id, status });
        return updated;
    }

    static async scheduleExam(id: string, adminId: string, examData: { examDate: string; examLocation: string; examNotes?: string }) {
        const application = await prisma.application.findUnique({
            where: { id },
            include: { applicant: true }
        });

        if (!application) throw new APIError(404, 'Application not found');
        // Enforce pipeline: exam can only be scheduled after UNDER_REVIEW (no skipping)
        if (application.status !== 'UNDER_REVIEW') {
            throw new APIError(400, 'Application must be in UNDER_REVIEW status to schedule exam');
        }

        const updated = await (prisma.application.update as any)({
            where: { id },
            data: {
                status: 'EXAM_SCHEDULED',
                examDate: examData.examDate,
                examLocation: examData.examLocation,
                examNotes: examData.examNotes || null,
                reviewerId: adminId
            },
            include: { preferredDept: true }
        });

        await prisma.admissionDecisionLog.create({
            data: {
                applicationId: id,
                adminId,
                statusAfter: 'EXAM_SCHEDULED',
                notes: `Exam scheduled: ${examData.examDate} @ ${examData.examLocation}`
            }
        });

        // Notify applicant
        if (application.applicant.email) {
            await EmailService.sendMail(
                application.applicant.email,
                '📋 Entrance Exam Scheduled - SASMS Admissions',
                `<p>Dear ${application.applicant.name},</p><p>Your entrance exam has been scheduled for <strong>${examData.examDate}</strong> at <strong>${examData.examLocation}</strong>.</p>${examData.examNotes ? `<p>Notes: ${examData.examNotes}</p>` : ''}<p>Please log in to your portal for full details.</p>`
            );
        }

        await prisma.notification.create({
            data: {
                text: `📋 Your entrance exam is scheduled for ${examData.examDate} at ${examData.examLocation}`,
                type: 'info',
                userId: application.applicantId,
                link: '/applicant/dashboard'
            }
        });

        await AuditService.logAction('SCHEDULE_EXAM', adminId, { applicationId: id, examDate: examData.examDate });
        return updated;
    }

    static async scheduleInterview(id: string, adminId: string, interviewData: { interviewDate: string; interviewLocation: string; interviewNotes?: string }) {
        const application = await prisma.application.findUnique({
            where: { id },
            include: { applicant: true }
        });

        if (!application) throw new APIError(404, 'Application not found');
        if (application.status !== 'EXAM_SCHEDULED') {
            throw new APIError(400, 'Application must have exam scheduled first');
        }

        const updated = await (prisma.application.update as any)({
            where: { id },
            data: {
                status: 'INTERVIEW_SCHEDULED',
                interviewDate: interviewData.interviewDate,
                interviewLocation: interviewData.interviewLocation,
                interviewNotes: interviewData.interviewNotes || null,
                reviewerId: adminId
            },
            include: { preferredDept: true }
        });

        await prisma.admissionDecisionLog.create({
            data: {
                applicationId: id,
                adminId,
                statusAfter: 'INTERVIEW_SCHEDULED',
                notes: `Interview scheduled: ${interviewData.interviewDate} @ ${interviewData.interviewLocation}`
            }
        });

        if (application.applicant.email) {
            await EmailService.sendMail(
                application.applicant.email,
                '🎉 Interview Invitation - SASMS Admissions',
                `<p>Dear ${application.applicant.name},</p><p>Congratulations! You have passed the entrance exam and are invited for an interview on <strong>${interviewData.interviewDate}</strong> at <strong>${interviewData.interviewLocation}</strong>.</p>${interviewData.interviewNotes ? `<p>Notes: ${interviewData.interviewNotes}</p>` : ''}<p>Please log in to your portal for full details.</p>`
            );
        }

        await prisma.notification.create({
            data: {
                text: `🎉 You passed the exam! Interview scheduled for ${interviewData.interviewDate} at ${interviewData.interviewLocation}`,
                type: 'success',
                userId: application.applicantId,
                link: '/applicant/dashboard'
            }
        });

        await AuditService.logAction('SCHEDULE_INTERVIEW', adminId, { applicationId: id, interviewDate: interviewData.interviewDate });
        return updated;
    }

    static async bulkMarkUnderReview(applicationIds: string[], adminId: string) {
        const results: { id: string; success: boolean; error?: string }[] = [];
        for (const id of applicationIds) {
            try {
                const app = await prisma.application.findUnique({ where: { id }, select: { status: true } });
                if (!app) throw new APIError(404, 'Application not found');
                if (app.status !== 'PENDING') throw new APIError(400, 'Application must be in PENDING status');
                await this.review(id, adminId, 'UNDER_REVIEW', undefined);
                results.push({ id, success: true });
            } catch (e: any) {
                results.push({ id, success: false, error: e?.message || 'Failed' });
            }
        }
        return { updated: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
    }

    static async bulkScheduleExam(applicationIds: string[], adminId: string, examData: { examDate: string; examLocation: string; examNotes?: string }) {
        const results: { id: string; success: boolean; error?: string }[] = [];
        for (const id of applicationIds) {
            try {
                await this.scheduleExam(id, adminId, examData);
                results.push({ id, success: true });
            } catch (e: any) {
                results.push({ id, success: false, error: e?.message || 'Failed' });
            }
        }
        return { updated: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
    }

    static async bulkScheduleInterview(applicationIds: string[], adminId: string, interviewData: { interviewDate: string; interviewLocation: string; interviewNotes?: string }) {
        const results: { id: string; success: boolean; error?: string }[] = [];
        for (const id of applicationIds) {
            try {
                await this.scheduleInterview(id, adminId, interviewData);
                results.push({ id, success: true });
            } catch (e: any) {
                results.push({ id, success: false, error: e?.message || 'Failed' });
            }
        }
        return { updated: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
    }

    static async convertToStudent(id: string, studentData: any) {
        const { studentClass, academicYear, departmentId, nationalId } = studentData;

        logger.info(`Converting application ${id} to student`);

        const application = await prisma.application.findUnique({
            where: { id },
            include: { applicant: true }
        });

        if (!application || application.status !== 'ACCEPTED') {
            throw new APIError(400, 'Application must be accepted before conversion');
        }

        return await prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: application.applicantId },
                data: {
                    role: 'STUDENT',
                    status: 'ACTIVE',
                    studentClass: studentClass || undefined,
                    admissionYear: academicYear || undefined,
                    departmentId: departmentId || undefined,
                    nationalId: nationalId || undefined
                }
            });

            await AuditService.logAction('CONVERT_TO_STUDENT', application.applicantId, { applicationId: id });
            return updatedUser;
        });
    }

    static async claimStudentRole(applicantId: string) {
        logger.info(`Applicant ${applicantId} claiming student role`);

        const application = await prisma.application.findUnique({
            where: { applicantId }
        });

        if (!application || application.status !== 'ACCEPTED') {
            throw new APIError(400, 'Your application has not been accepted yet.');
        }

        const user = await prisma.user.findUnique({ where: { id: applicantId } });
        if (user?.role === 'STUDENT') {
            throw new APIError(400, 'You have already been registered as a student.');
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                const updatedUser = await tx.user.update({
                    where: { id: applicantId },
                    data: {
                        role: 'STUDENT',
                        status: 'ACTIVE',
                        departmentId: application.preferredDeptId || null
                    }
                });

                return updatedUser;
            }, {
                timeout: 15000
            });

            await AuditService.logAction('CLAIM_STUDENT_ROLE', applicantId, { applicationId: application.id });
            return result;
        } catch (error) {
            logger.error(`Error converting applicant ${applicantId} to student:`, error);
            throw error;
        }
    }
}
