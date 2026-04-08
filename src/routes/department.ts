import { Router } from 'express';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/department.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Publicly available to authenticated users
router.get('/', authenticate, getDepartments);

// Restricted to SuperAdmin and Admin
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), createDepartment);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), updateDepartment);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), deleteDepartment);

export default router;
