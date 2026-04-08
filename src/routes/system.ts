import { Router } from 'express';
import { getDashboardKPIs, getAuditLogs, getSystemSettings, updateSystemSettings, uploadSystemLogo, resetSystemSettings, getPublicBranding, getCustomFormFields, saveCustomFormFields, getTeacherOfMonth, setTeacherOfMonth, downloadTeacherOfMonthPdf } from '../controllers/system.js';
import { authenticate, authorize } from '../middleware/auth.js';
import upload, { avatarUpload } from '../middleware/upload.js';

const router = Router();

// Public endpoints (no auth required)
router.get('/branding', getPublicBranding);
router.get('/form-fields', getCustomFormFields);
router.get('/teacher-of-month', getTeacherOfMonth);

// Protected endpoints
router.get('/kpis', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getDashboardKPIs);
router.get('/audit-logs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getAuditLogs);
router.get('/settings', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getSystemSettings);
router.put('/settings', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), updateSystemSettings);
router.post('/settings/logo', authenticate, authorize(['SUPER_ADMIN']), avatarUpload.single('logo'), uploadSystemLogo);
router.post('/settings/reset', authenticate, authorize(['SUPER_ADMIN']), resetSystemSettings);

router.post('/form-fields', authenticate, authorize(['SUPER_ADMIN']), saveCustomFormFields);

router.post('/teacher-of-month', authenticate, authorize(['SUPER_ADMIN']), setTeacherOfMonth);
router.post('/teacher-of-month/upload', authenticate, authorize(['SUPER_ADMIN']), upload.single('image'), async (req: any, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No image uploaded' });
  res.json({ path: `uploads/${file.filename}` });
});
router.get('/teacher-of-month/pdf', authenticate, authorize(['SUPER_ADMIN']), downloadTeacherOfMonthPdf);

export default router;
