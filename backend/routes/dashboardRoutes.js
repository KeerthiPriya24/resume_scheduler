const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getRecruiterStats, getPipeline, closeJob, getRecruiterInterviews, getJobSeekerInterviews, getRecruiterAvailability } = require('../controllers/dashboardController');
const router = express.Router();

router.get('/recruiter', authenticate, requireRole('recruiter'), getRecruiterStats);
router.get('/recruiter/interviews', authenticate, requireRole('recruiter'), getRecruiterInterviews);
router.get('/recruiter/availability', authenticate, requireRole('recruiter'), getRecruiterAvailability);
router.get('/jobseeker/interviews', authenticate, requireRole('jobseeker'), getJobSeekerInterviews);
router.get('/pipeline/:jobId', authenticate, requireRole('recruiter'), getPipeline);
router.put('/close/:jobId', authenticate, requireRole('recruiter'), closeJob);

module.exports = router;
