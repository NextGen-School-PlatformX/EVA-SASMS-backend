import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as AcademicController from '../controllers/academic.js';

const router = Router();

router.get('/years', authenticate, AcademicController.getYears);
router.post('/years', authenticate, authorize(['SUPER_ADMIN']), AcademicController.createYear);
router.delete('/years/:id', authenticate, authorize(['SUPER_ADMIN']), AcademicController.deleteYear);

router.get('/years/:yearId/departments', authenticate, AcademicController.getDepartments);
router.post('/years/:yearId/departments', authenticate, authorize(['SUPER_ADMIN']), AcademicController.createDepartment);
router.delete('/departments/:id', authenticate, authorize(['SUPER_ADMIN']), AcademicController.deleteDepartment);

router.get('/departments/:departmentId/classes', authenticate, AcademicController.getClasses);
router.post('/departments/:departmentId/classes', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AcademicController.createClass);
router.delete('/classes/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AcademicController.deleteClass);

router.get('/classes/:classId/students', authenticate, AcademicController.getClassStudents);

export default router;
