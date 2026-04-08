import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    } : undefined,
});

export class EmailService {
    static async sendMail(to: string, subject: string, html: string): Promise<boolean> {
        // If no SMTP host configured, skip silently — don't block operations
        if (!process.env.SMTP_HOST) {
            logger.info(`[Email skipped - no SMTP configured] To: ${to} | Subject: ${subject}`);
            return false;
        }
        try {
            const info = await transporter.sendMail({
                from: process.env.EMAIL_FROM || '"SASMS" <no-reply@sasms.edu.eg>',
                to,
                subject,
                html,
            });
            logger.info(`Email sent: ${info.messageId}`);
            return true;
        } catch (error: any) {
            // Log warning but DO NOT throw — email failure should never block the operation
            logger.warn(`Email delivery failed (non-blocking): ${error.message}`);
            return false;
        }
    }

    static async sendPasswordReset(email: string, token: string): Promise<boolean> {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #1976d2; text-align: center;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>You requested to reset your password for the SASMS portal. Click the button below to proceed:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                </div>
                <p>If you did not request this, please ignore this email.</p>
                <p>This link will expire in 1 hour.</p>
            </div>
        `;
        return this.sendMail(email, 'Reset Your Password - SASMS', html);
    }

    static async sendCredentials(email: string, name: string, password: string): Promise<boolean> {
        const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/login';
        const html = `<div style="font-family:sans-serif;max-width:600px;padding:20px"><h2>SASMS - Your Student Account</h2><p>Hello ${name},</p><p>Your account has been created. Use these credentials to log in:</p><p><strong>Email:</strong> ${email}</p><p><strong>Password:</strong> ${password}</p><p>Please change your password after first login.</p><a href="${loginUrl}" style="background:#1976d2;color:white;padding:12px 24px;text-decoration:none;border-radius:5px">Log In</a></div>`;
        return this.sendMail(email, 'Your SASMS Student Account - Login Credentials', html);
    }
}
