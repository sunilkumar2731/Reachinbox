import { Router } from 'express';
import { SlackController } from '../controllers/slackController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// OAuth callback is called by Slack redirection
router.get('/callback', SlackController.callback);

// Protected routes
router.get('/connect', requireAuth, SlackController.connect);
router.get('/status', requireAuth, SlackController.getStatus);
router.post('/disconnect', requireAuth, SlackController.disconnect);

export default router;
