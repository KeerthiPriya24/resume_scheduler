const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getInterviewsByJob, getByToken, postAvailability, getSlots, book, makeDecision, setRecruiterAvailability } = require('../controllers/interviewController');
const router = express.Router();

router.get('/job/:jobId', authenticate, requireRole('recruiter'), getInterviewsByJob);
router.get('/schedule/:token', getByToken); // Public - accessed via email link
router.post('/availability/:interviewId', postAvailability); // Public - via scheduling link
router.get('/slots/:interviewId', getSlots);
router.post('/book/:interviewId', book);
router.put('/decision/:interviewId', authenticate, requireRole('recruiter'), makeDecision);
router.post('/recruiter-availability', authenticate, requireRole('recruiter'), setRecruiterAvailability);

module.exports = router;
