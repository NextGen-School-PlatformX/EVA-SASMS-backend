import { Router } from 'express';
import { getUsers, createStaff, updateUserStatus, deleteUser } from '../controllers/user.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All user management routes are restricted to SuperAdmin
router.use(authenticate, authorize(['SUPER_ADMIN', 'ADMIN']));

router.get('/', getUsers);
router.post('/', createStaff);
router.patch('/:id/status', updateUserStatus);
router.delete('/:id', deleteUser);

export default router;
