const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { postJob, getAllJobs, getJobById, getRecruiterJobs, updateJobStatus } = require('../controllers/jobController');
const router = express.Router();

router.get('/', getAllJobs);
router.get('/recruiter/mine', authenticate, requireRole('recruiter'), getRecruiterJobs);
router.get('/:id', getJobById);
router.post('/', authenticate, requireRole('recruiter'), postJob);
router.put('/:id/status', authenticate, requireRole('recruiter'), updateJobStatus);

module.exports = router;
