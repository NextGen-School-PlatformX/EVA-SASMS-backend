import { Router } from 'express';
import {
    getFeeCategories,
    createFeeCategory,
    processPayment,
    getTransactions,
    getFees,
    createFee,
    getFeePayments,
    approveFeePayment,
    getPaymentMethods,
    savePaymentMethods,
} from '../controllers/finance.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/categories', getFeeCategories);
router.get('/transactions', authorize(['SUPER_ADMIN', 'ADMIN']), getTransactions);
router.post('/categories', authorize(['SUPER_ADMIN', 'ADMIN']), createFeeCategory);
router.post('/payments', authorize(['SUPER_ADMIN', 'ADMIN']), processPayment);

// Fee management (SuperAdmin creates fees → shown to students)
router.get('/fees', getFees);
router.post('/fees', authorize(['SUPER_ADMIN', 'ADMIN']), createFee);
router.get('/fee-payments', authorize(['SUPER_ADMIN', 'ADMIN']), getFeePayments);
router.put('/fee-payments/:id/approve', authorize(['SUPER_ADMIN', 'ADMIN']), approveFeePayment);

// Payment methods (SuperAdmin config, Admin read-only)
router.get('/payment-methods', authorize(['SUPER_ADMIN', 'ADMIN']), getPaymentMethods);
router.post('/payment-methods', authorize(['SUPER_ADMIN']), savePaymentMethods);

export default router;
