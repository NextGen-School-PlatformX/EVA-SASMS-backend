import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(3),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string(),
    }),
});

export const applicationSubmissionSchema = z.object({
    body: z.object({
        nationalId: z.string().optional(),
        preferredDeptId: z.string().uuid(),
        selectionReason: z.string().optional(),
        phoneNumber: z.string().optional(),
        customFieldsData: z.string().optional(),
        ministryScore: z.string().optional(),
    }),
});

export const applicationReviewSchema = z.object({
    body: z.object({
        status: z.enum(['PENDING', 'UNDER_REVIEW', 'EXAM_SCHEDULED', 'INTERVIEW_SCHEDULED', 'ACCEPTED', 'REJECTED']),
        feedback: z.string().optional(),
    }),
});

export const studentConversionSchema = z.object({
    body: z.object({
        studentClass: z.string(),
        academicYear: z.string(),
        departmentId: z.string().uuid(),
        nationalId: z.string(),
    }),
});
