import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';

export class AuditService {
    static async logAction(action: string, userId?: string, details?: any, ipAddress?: string) {
        try {
            const log = await prisma.auditLog.create({
                data: {
                    action,
                    userId,
                    details: details ? JSON.stringify(details) : null,
                    ipAddress,
                },
            });
            logger.info(`Audit logged: ${action} by ${userId || 'SYSTEM'}`);
            return log;
        } catch (error: any) {
            console.error(`[AUDIT_ERROR] Failed to log audit: ${error.message}`);
            logger.error(`Failed to log audit: ${error.message}`);
            // Don't throw here to avoid breaking the main flow for a logging failure
        }
    }
}
