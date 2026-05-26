import express from 'express';
import * as bookController from '../controllers/bookController.js';
import * as requestController from '../controllers/requestController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, bookController.getAllBooks);
router.post('/', requireAuth, requireRole('admin'), bookController.createBook);
router.put('/:id', requireAuth, requireRole('admin'), bookController.updateBook);
router.delete('/:id', requireAuth, requireRole('admin'), bookController.deleteBook);
router.post('/:id/issue', requireAuth, requireRole('admin'), bookController.issueBook);
router.post('/:id/return', requireAuth, requireRole('admin'), bookController.returnBook);

// Note: This matches the original path /api/books/:id/request
router.post('/:id/request', requireAuth, requireRole('student'), requestController.createRequest);

export default router;
