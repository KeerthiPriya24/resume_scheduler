const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getRecruiterStats, getPipeline, closeJob } = require('../controllers/dashboardController');
const router = express.Router();

router.get('/recruiter', authenticate, requireRole('recruiter'), getRecruiterStats);
router.get('/pipeline/:jobId', authenticate, requireRole('recruiter'), getPipeline);
router.put('/close/:jobId', authenticate, requireRole('recruiter'), closeJob);

module.exports = router;
