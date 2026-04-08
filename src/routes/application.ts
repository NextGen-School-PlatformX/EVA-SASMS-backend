import { Router } from 'express';
import {
    submitApplication,
    getApplications,
    reviewApplication,
    scheduleExam,
    scheduleInterview,
    bulkMarkUnderReview,
    bulkScheduleExam,
    bulkScheduleInterview,
    convertToStudent,
    claimStudentRole,
    serveDocument,
    getMyApplication,
    setExamScore,
    setInterviewScore,
    getLeaderboard,
    getAdmissionWindow,
    setAdmissionWindow,
    getAdmissionThreshold,
    setAdmissionThreshold,
} from '../controllers/application.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { applicationSubmissionSchema, applicationReviewSchema, studentConversionSchema } from '../validations/schemas.js';
import upload from '../middleware/upload.js';

const router = Router();

// Public
router.get('/window', getAdmissionWindow);
router.get('/threshold', getAdmissionThreshold);
router.put('/threshold', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), setAdmissionThreshold);

// Applicants
router.post('/submit', authenticate, authorize(['APPLICANT']), upload.fields([
    { name: 'birthCertificate', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'ministryResult', maxCount: 1 },
    { name: 'receipt', maxCount: 1 },
    // Extra dynamic documentation uploads configured by SuperAdmin
    { name: 'otherDocs', maxCount: 10 }
]), validate(applicationSubmissionSchema), submitApplication);
router.get('/me', authenticate, authorize(['APPLICANT']), getMyApplication);
router.post('/claim-student-role', authenticate, authorize(['APPLICANT']), claimStudentRole);

// Admin only
router.get('/leaderboard', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getLeaderboard);
router.put('/window', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), setAdmissionWindow);
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), getApplications);
router.patch('/:id/review', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(applicationReviewSchema), reviewApplication);
router.post('/:id/schedule-exam', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), scheduleExam);
router.post('/:id/schedule-interview', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), scheduleInterview);
router.patch('/bulk-under-review', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), bulkMarkUnderReview);
router.post('/bulk-schedule-exam', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), bulkScheduleExam);
router.post('/bulk-schedule-interview', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), bulkScheduleInterview);
router.patch('/:id/exam-score', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), setExamScore);
router.patch('/:id/interview-score', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), setInterviewScore);
router.post('/convert/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(studentConversionSchema), convertToStudent);
// Documents - public access (used by img tags that can't send auth headers)
router.get('/documents/:filename', serveDocument);

export default router;
