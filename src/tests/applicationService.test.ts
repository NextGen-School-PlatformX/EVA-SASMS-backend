import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        default: mockDeep(),
    };
});

import prisma from '../lib/prisma.js';
import { ApplicationService } from '../services/applicationService.js';

const prismaMock = prisma as any;

describe('ApplicationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('submit', () => {
        it('should submit an application successfully', async () => {
            const applicantId = 'applicant-1';
            const applicationData = { nationalId: '123456789', preferredDeptId: 'dept-1', selectionReason: 'Interested in tech' };

            prismaMock.application.upsert.mockResolvedValue({
                id: 'app-1',
                applicantId,
                ...applicationData,
                status: 'PENDING'
            } as any);

            const result = await ApplicationService.submit(applicantId, applicationData, {});

            expect(result.applicantId).toBe(applicantId);
            expect(result.status).toBe('PENDING');
            expect(prismaMock.application.upsert).toHaveBeenCalled();
        });
    });

    describe('getByApplicantId', () => {
        it('should return application if found', async () => {
            const applicantId = 'applicant-1';
            prismaMock.application.findUnique.mockResolvedValue({ id: 'app-1', applicantId } as any);

            const result = await ApplicationService.getByApplicantId(applicantId);

            expect(result?.applicantId).toBe(applicantId);
        });

        it('should return null if not found', async () => {
            prismaMock.application.findUnique.mockResolvedValue(null);
            const result = await ApplicationService.getByApplicantId('non-existent');
            expect(result).toBeNull();
        });
    });
});
