import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as AttendanceController from '../controllers/attendance.js';

const router = Router();

// Admin routes
router.post('/session', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AttendanceController.createSession);
router.get('/sessions', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AttendanceController.getAllSessions);
router.get('/session/:sessionId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AttendanceController.getSessionReport);
router.get('/session/:sessionId/qr', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AttendanceController.getSessionQR);
router.post('/session/:sessionId/auto-absent', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AttendanceController.autoMarkAbsent);

// Student routes
router.post('/scan', authenticate, authorize(['STUDENT']), AttendanceController.validateScan);
router.get('/me', authenticate, authorize(['STUDENT']), AttendanceController.getMyAttendance);

export default router;
