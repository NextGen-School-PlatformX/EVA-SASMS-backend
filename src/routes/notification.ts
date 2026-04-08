import { Router } from 'express';
import { getNotifications, markNotificationRead, createNotification, markAllRead } from '../controllers/notification.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getNotifications);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markNotificationRead);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), createNotification);

export default router;
