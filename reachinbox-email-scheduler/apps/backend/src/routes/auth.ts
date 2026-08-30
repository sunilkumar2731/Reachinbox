import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);
router.get('/me', AuthController.getMe);
router.post('/logout', AuthController.logout);
router.post('/dev-login', AuthController.devLogin);


export default router;
