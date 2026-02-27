const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { propose, confirm, remove, getStatus, shortlistIndividualCandidate } = require('../controllers/shortlistController');
const router = express.Router();

router.post('/propose/:jobId', authenticate, requireRole('recruiter'), propose);
router.post('/confirm/:jobId', authenticate, requireRole('recruiter'), confirm);
router.post('/individual/:applicationId', authenticate, requireRole('recruiter'), shortlistIndividualCandidate);
router.delete('/remove/:jobId/:applicationId', authenticate, requireRole('recruiter'), remove);
router.get('/:jobId', authenticate, requireRole('recruiter'), getStatus);

module.exports = router;
