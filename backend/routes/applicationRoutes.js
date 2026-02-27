const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireRole } = require('../middleware/auth');
const { applyToJob, getApplicationsByJob, getMyApplications } = require('../controllers/applicationController');
const router = express.Router();

// Configure multer for resume uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
});

router.post('/:jobId', authenticate, requireRole('jobseeker'), upload.single('resume'), applyToJob);
router.get('/job/:jobId', authenticate, requireRole('recruiter'), getApplicationsByJob);
router.get('/mine', authenticate, requireRole('jobseeker'), getMyApplications);

module.exports = router;
