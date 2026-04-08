import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as EmpAttendance from '../controllers/employeeAttendance.js';

const router = Router();

// ── Employee Self-Service ────────────────────────────────────────────────────
router.post('/my-checkin', authenticate, EmpAttendance.myCheckIn);
router.post('/my-checkout', authenticate, EmpAttendance.myCheckOut);
router.get('/my-records', authenticate, EmpAttendance.getMyEmployeeAttendance);

// ── QR Check-In ──────────────────────────────────────────────────────────────
router.post('/qr-checkin', EmpAttendance.qrCheckIn); // No auth — scanned from QR

// ── Admin / Management ───────────────────────────────────────────────────────
router.post('/mark-late-now', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.markLateNow);
router.post('/auto-checkout', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.autoCheckout);
router.post('/process-day', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.processDay);

router.get('/records', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.getAllEmployeeAttendance);

// ── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.getAttendanceSettings);
router.put('/settings', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.updateAttendanceSettings);
router.put('/schedule', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.updateWeeklySchedule);
router.post('/holidays', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.addPublicHoliday);
router.delete('/holidays/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), EmpAttendance.deletePublicHoliday);

export default router;
