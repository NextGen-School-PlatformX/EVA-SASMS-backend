import { Router } from 'express';
import { register, login, getMe, requestPasswordReset, resetPassword, updateProfile, uploadAvatar } from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validations/schemas.js';
import { avatarUpload } from '../middleware/upload.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.post('/profile/avatar', authenticate, avatarUpload.single('avatar'), uploadAvatar);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;
