import { beforeAll, afterAll, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import prisma from '../lib/prisma.js';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.test' });

beforeAll(async () => {
    // Sync DB schema only once if possible, or handle locking
    // For Vitest, we can use a global setup file instead of beforeAll in every file
    // But for now, let's just try to be more careful. 
    // Actually, I'll move this to a separate global setup or skip it if already done.
});

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    // Clear models in correct order to respect dependencies
    const models = [
        'auditLog',
        'transaction',
        'feeCategory',
        'supportMessage',
        'supportTicket',
        'application',
        'passwordResetToken',
        'staff',
        'user',
        'department'
    ];

    for (const model of models) {
        if ((prisma as any)[model]) {
            await (prisma as any)[model].deleteMany();
        }
    }
});
