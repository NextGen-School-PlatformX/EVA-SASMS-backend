import { vi, describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../lib/prisma.js', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        default: mockDeep(),
    };
});

import prisma from '../lib/prisma.js';
import { AuthService } from '../services/authService.js';

const prismaMock = prisma as any;

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const userData = { email: 'test@example.com', password: 'password123', name: 'Test User' };

            prismaMock.user.findUnique.mockResolvedValue(null);
            prismaMock.user.create.mockResolvedValue({
                id: '1',
                email: userData.email,
                name: userData.name,
                role: 'APPLICANT',
                password: 'hashedPassword'
            } as any);

            const result = await AuthService.register(userData);

            expect(result.user.email).toBe(userData.email);
            expect(result.token).toBeDefined();
            expect(prismaMock.user.create).toHaveBeenCalled();
        });

        it('should throw error if user already exists', async () => {
            const userData = { email: 'existing@example.com', password: 'password123', name: 'Existing User' };

            prismaMock.user.findUnique.mockResolvedValue({ id: '1' } as any);

            await expect(AuthService.register(userData)).rejects.toThrow('User already exists');
        });
    });

    describe('login', () => {
        it('should login successfully with correct credentials', async () => {
            const loginData = { email: 'test@example.com', password: 'password123' };
            const hashedPassword = await bcrypt.hash(loginData.password, 10);

            prismaMock.user.findUnique.mockResolvedValue({
                id: '1',
                email: loginData.email,
                password: hashedPassword,
                name: 'Test User',
                role: 'APPLICANT'
            } as any);

            const result = await AuthService.login(loginData);

            expect(result.user.email).toBe(loginData.email);
            expect(result.token).toBeDefined();
        });

        it('should throw error with incorrect password', async () => {
            const loginData = { email: 'test@example.com', password: 'wrongpassword' };
            const hashedPassword = await bcrypt.hash('correctpassword', 10);

            prismaMock.user.findUnique.mockResolvedValue({
                id: '1',
                email: loginData.email,
                password: hashedPassword
            } as any);

            await expect(AuthService.login(loginData)).rejects.toThrow('Invalid credentials');
        });
    });
});
