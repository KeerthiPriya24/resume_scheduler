const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { processApplication, processAllForJob, getScores } = require('../controllers/aiController');
const router = express.Router();

router.post('/process/:applicationId', authenticate, requireRole('recruiter'), processApplication);
router.post('/process-all/:jobId', authenticate, requireRole('recruiter'), processAllForJob);
router.get('/scores/:jobId', authenticate, requireRole('recruiter'), getScores);

module.exports = router;
