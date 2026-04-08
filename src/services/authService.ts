import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { EmailService } from './emailService.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class AuthService {
    static async register(data: any) {
        const { email, password, name } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            logger.warn(`Registration attempt failed: Email ${email} already exists`);
            throw new APIError(400, 'User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'APPLICANT',
            },
            select: { id: true, email: true, name: true, role: true }
        });

        logger.info(`New user registered: ${email} (${user.id})`);

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
            expiresIn: '24h',
        });

        return { user, token };
    }

    static async login(data: any) {
        const { email, password } = data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            logger.warn(`Login attempt failed: Email ${email} not found`);
            throw new APIError(401, 'Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Login attempt failed: Incorrect password for ${email}`);
            throw new APIError(401, 'Invalid credentials');
        }

        if (user.status !== 'ACTIVE') {
            logger.warn(`Login blocked: Account suspended/inactive for ${email}`);
            throw new APIError(401, 'Account suspended or inactive. Please contact support.');
        }

        logger.info(`User logged in: ${email} (${user.id})`);

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
            expiresIn: '24h',
        });

        return {
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token,
        };
    }

    static async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, phoneNumber: true }
        });

        if (!user) {
            throw new APIError(404, 'User not found');
        }

        return user;
    }

    static async updateAvatar(userId: string, avatarPath: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new APIError(404, 'User not found');
        return await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: avatarPath },
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, phoneNumber: true }
        });
    }

    static async requestPasswordReset(email: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Don't reveal user existence for security, just log
            logger.warn(`Password reset requested for non-existent email: ${email}`);
            return;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await prisma.passwordResetToken.upsert({
            where: { userId: user.id },
            update: { token, expiresAt },
            create: { userId: user.id, token, expiresAt }
        });

        await EmailService.sendPasswordReset(email, token);
        logger.info(`Password reset token sent to ${email}`);
    }

    static async resetPassword(token: string, newPassword: string) {
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token }
        });

        if (!resetToken || resetToken.expiresAt < new Date()) {
            throw new APIError(400, 'Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: resetToken.userId },
            data: { password: hashedPassword }
        });

        await prisma.passwordResetToken.delete({
            where: { id: resetToken.id }
        });

        logger.info(`Password reset successful for user ${resetToken.userId}`);
    }

    static async updateProfile(userId: string, data: { name?: string; phone?: string; phoneNumber?: string; currentPassword?: string; newPassword?: string }) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new APIError(404, 'User not found');

        const updateData: any = {};

        if (data.name) updateData.name = data.name;
        if (data.phone !== undefined) updateData.phoneNumber = data.phone;
        if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;

        if (data.newPassword && data.currentPassword) {
            const isValidPwd = await bcrypt.compare(data.currentPassword, user.password);
            if (!isValidPwd) throw new APIError(400, 'Current password is incorrect');
            updateData.password = await bcrypt.hash(data.newPassword, 10);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, phoneNumber: true, departmentId: true, status: true }
        });

        return updated;
    }

    static async createStaff(data: any, creatorId: string) {
        const { email, password, name, role, departmentId } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new APIError(400, 'User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'ADMIN',
                departmentId,
                status: 'ACTIVE'
            }
        });

        // Audit log would be called from controller
        return user;
    }
}
