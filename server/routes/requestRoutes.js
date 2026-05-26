import express from 'express';
import * as requestController from '../controllers/requestController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requestController.getAllRequests);
router.post('/:id/approve', requireAuth, requireRole('admin'), requestController.approveRequest);
router.post('/:id/reject', requireAuth, requireRole('admin'), requestController.rejectRequest);

export default router;
