import { Router } from 'express';
import { downloadStudentReport, downloadFinanceReport, downloadStudentPDF, downloadFinancePDF } from '../controllers/report.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize(['SUPER_ADMIN', 'ADMIN']));

router.get('/students/csv', downloadStudentReport);
router.get('/finance/csv', downloadFinanceReport);
router.get('/students/pdf', downloadStudentPDF);
router.get('/finance/pdf', downloadFinancePDF);


export default router;
