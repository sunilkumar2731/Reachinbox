import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// Protect all email routes with authentication
router.use(requireAuth);

router.post('/schedule', EmailController.schedule);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.get('/search', EmailController.search);
router.get('/:id', EmailController.getById);

export default router;
