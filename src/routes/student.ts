import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as studentController from '../controllers/studentController.js';
import upload, { avatarUpload } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize(['STUDENT']));

// Profile
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.updateProfile);
router.post('/profile/avatar', avatarUpload.single('avatar'), studentController.uploadAvatar);

// Admissions
router.get('/admissions', studentController.getAdmissionsSummary);

// Fees
router.get('/fees', studentController.getFees);
router.post('/fees/pay', upload.single('receipt'), studentController.payFee);

// Complaints
router.get('/complaints', studentController.getComplaints);
router.post('/complaints', studentController.createComplaint);
router.post('/complaints/:id/messages', studentController.addComplaintMessage);

// Activities
router.get('/activities', studentController.getActivities);
router.post('/activities/:id/join', studentController.joinActivity);
router.delete('/activities/:activityId/leave', studentController.leaveActivity);

// Notifications
router.get('/notifications', studentController.getNotifications);

export default router;
