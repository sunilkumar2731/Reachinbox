import { Router } from 'express';
import { SenderController } from '../controllers/senderController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(requireAuth);

router.get('/', SenderController.list);
router.post('/', SenderController.create);

export default router;
