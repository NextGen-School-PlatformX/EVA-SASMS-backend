import type { Request, Response } from 'express';
import { AuthService } from '../services/authService.js';

export const register = async (req: Request, res: Response) => {
    try {
        const result = await AuthService.register(req.body);
        res.status(201).json(result);
    } catch (error) {
        throw error;
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const result = await AuthService.login(req.body);
        res.json(result);
    } catch (error) {
        throw error;
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await AuthService.getProfile(userId);
        res.json(user);
    } catch (error) {
        throw error;
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const result = await AuthService.updateProfile(userId, req.body);
        res.json({ message: 'Profile updated successfully', user: result });
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Error updating profile' });
    }
};

export const uploadAvatar = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: 'No avatar file uploaded' });
        const avatarPath = 'uploads/' + file.filename;
        const result = await AuthService.updateAvatar(userId, avatarPath);
        res.json({ message: 'Avatar updated successfully', user: result, avatarUrl: avatarPath });
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Error uploading avatar' });
    }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        await AuthService.requestPasswordReset(email);
        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error: any) {
        // Don't reveal whether email exists
        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }
        await AuthService.resetPassword(token, newPassword);
        res.json({ message: 'Password has been reset successfully.' });
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Invalid or expired token' });
    }
};
