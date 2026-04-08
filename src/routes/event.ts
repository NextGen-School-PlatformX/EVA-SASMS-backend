import { Router } from 'express';
import { getEvents, createEvent, deleteEvent, joinEvent, leaveEvent } from '../controllers/event.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getEvents);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), createEvent);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN']), deleteEvent);

// Real Join/Leave
router.post('/:id/join', authenticate, authorize(['STUDENT', 'ADMIN', 'SUPER_ADMIN']), joinEvent);
router.post('/:id/leave', authenticate, authorize(['STUDENT', 'ADMIN', 'SUPER_ADMIN']), leaveEvent);


export default router;
