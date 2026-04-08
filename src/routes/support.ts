import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as SupportController from '../controllers/support.js';

const router = Router();

router.get('/tickets', authenticate, SupportController.getTickets);
router.post('/tickets', authenticate, SupportController.createTicket);
router.post('/tickets/:id/respond', authenticate, SupportController.respondToTicket);
router.patch('/tickets/:id/resolve', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), SupportController.resolveTicket);

// Admin: Student Complaints
router.get('/complaints', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), SupportController.getStudentComplaints);
router.post('/complaints/:id/respond', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), SupportController.addStudentComplaintMessage);
router.patch('/complaints/:id/resolve', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), SupportController.resolveStudentComplaint);

export default router;
