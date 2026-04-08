import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.js';
import * as AdminController from '../controllers/adminController.js';
import * as FinanceController from '../controllers/finance.js';

const router = Router();
const uploadCsv = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /csv|text|plain|sheet/.test(file.mimetype) || /\.(csv|txt|xlsx?)$/i.test(file.originalname);
        cb(null, !!ok);
    }
});

router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

// Student Management
router.get('/students', AdminController.getStudents);
router.post('/students/import', uploadCsv.single('file'), AdminController.importStudents);
router.post('/students/enroll', AdminController.enrollStudents);
router.put('/students/:id', AdminController.updateStudent);

// Student Bulk Actions
router.post('/students/promote', AdminController.promoteStudents);
router.post('/students/status', AdminController.updateStudentStatus);

// Finance Management
router.get('/fees', FinanceController.getFees);
router.post('/fees', FinanceController.createFee);

// Fee Payment Management
router.get('/fees/payments', AdminController.getFeePayments);
router.patch('/fees/payments/:id', AdminController.reviewFeePayment);

export default router;
