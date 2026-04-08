import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

describe('SuperAdmin Integration Tests', () => {
    let superAdminToken: string;
    let superAdminId: string;

    beforeAll(async () => {
        // Create a root SuperAdmin for testing
        const hashedPassword = await bcrypt.hash('password123', 10);
        const user = await prisma.user.create({
            data: {
                email: 'test-admin@sasms.edu.eg',
                password: hashedPassword,
                name: 'Test SuperAdmin',
                role: 'SUPER_ADMIN',
                status: 'ACTIVE'
            }
        });
        superAdminId = user.id;

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test-admin@sasms.edu.eg',
                password: 'password123'
            });

        superAdminToken = response.body.token;
    });

    describe('Department Management', () => {
        it('should create a new department', async () => {
            const response = await request(app)
                .post('/api/departments')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    name: 'Computer Science',
                    description: 'CS Department',
                    icon: 'Code'
                });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Computer Science');

            // Verify in DB
            const dept = await prisma.department.findUnique({ where: { name: 'Computer Science' } });
            expect(dept).toBeDefined();

            // Verify Audit Log
            const audit = await prisma.auditLog.findFirst({
                where: { action: 'CREATE_DEPARTMENT' }
            });
            expect(audit).toBeDefined();
            expect(audit?.userId).toBe(superAdminId);
        });

        it('should list all departments', async () => {
            const response = await request(app)
                .get('/api/departments')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should update a department', async () => {
            const dept = await prisma.department.create({
                data: { name: 'Physics', description: 'Original' }
            });

            const response = await request(app)
                .put(`/api/departments/${dept.id}`)
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({ description: 'Updated' });

            expect(response.status).toBe(200);
            expect(response.body.description).toBe('Updated');
        });
    });

    describe('Staff & User Management', () => {
        it('should create a new staff user', async () => {
            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    email: 'new-staff@sasms.edu.eg',
                    password: 'password123',
                    name: 'New Staff',
                    role: 'STAFF'
                });

            expect(response.status).toBe(201);
            expect(response.body.email).toBe('new-staff@sasms.edu.eg');

            const user = await prisma.user.findUnique({ where: { email: 'new-staff@sasms.edu.eg' } });
            expect(user?.role).toBe('STAFF');
        });
    });

    describe('System Oversight', () => {
        it('should fetch system KPIs', async () => {
            const response = await request(app)
                .get('/api/system/kpis')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalStudents');
            expect(response.body).toHaveProperty('departmentsCount');
        });

        it('should fetch audit logs', async () => {
            // Create a log entry first
            await prisma.auditLog.create({
                data: { action: 'TEST_ACTION', userId: superAdminId, details: '{}' }
            });

            const response = await request(app)
                .get('/api/system/audit-logs')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });
        it('should allow ADMIN to update system settings', async () => {
            // Create an ADMIN user
            const adminPassword = await bcrypt.hash('admin123', 10);
            await prisma.user.create({
                data: {
                    email: 'admin-test@sasms.edu.eg',
                    password: adminPassword,
                    name: 'Test Admin',
                    role: 'ADMIN',
                    status: 'ACTIVE'
                }
            });

            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: 'admin-test@sasms.edu.eg', password: 'admin123' });

            const adminToken = loginRes.body.token;

            const response = await request(app)
                .put('/api/system/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ minAdmissionScore: 85 });

            expect(response.status).toBe(200);
            expect(response.body.minAdmissionScore).toBe(85);
        });
    });

    describe('RBAC Security', () => {
        it('should block non-admin from creating departments', async () => {
            // Create a regular student with hashed password
            const hashedStudentPassword = await bcrypt.hash('pass123', 10);
            const student = await prisma.user.create({
                data: {
                    email: 'student@test.com',
                    password: hashedStudentPassword,
                    name: 'Student',
                    role: 'STUDENT'
                }
            });

            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: 'student@test.com', password: 'pass123' });

            const studentToken = loginRes.body.token;

            const response = await request(app)
                .post('/api/departments')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ name: 'Hacker Dept' });

            expect(response.status).toBe(403);
        });
    });
});
