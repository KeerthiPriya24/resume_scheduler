const db = require('../database/init');
const path = require('path');

const applyToJob = (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.id;

        const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND job_status = ?').get(jobId, 'open');
        if (!job) return res.status(404).json({ error: 'Job not found or no longer open.' });

        const existing = db.prepare('SELECT id FROM applications WHERE job_id = ? AND user_id = ?').get(jobId, userId);
        if (existing) return res.status(409).json({ error: 'You have already applied to this job.' });

        if (!req.file) {
            return res.status(400).json({ error: 'Resume upload is required to apply for this job.' });
        }

        const resumePath = req.file.filename;

        const result = db.prepare(`
      INSERT INTO applications (job_id, user_id, resume_path, status) VALUES (?, ?, ?, 'pending_ai_processing')
    `).run(jobId, userId, resumePath);

        res.status(201).json({
            message: 'Application submitted successfully',
            application: { id: result.lastInsertRowid, job_id: parseInt(jobId), status: 'pending_ai_processing' }
        });
    } catch (err) {
        console.error('Apply error:', err);
        res.status(500).json({ error: 'Server error submitting application.' });
    }
};

const getApplicationsByJob = (req, res) => {
    try {
        const { jobId } = req.params;
        const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?').get(jobId, req.user.id);
        if (!job) return res.status(403).json({ error: 'Not authorized to view these applications.' });

        const applications = db.prepare(`
      SELECT a.*, u.name as candidate_name, u.email as candidate_email,
      ai.overall_fit_score, ai.matched_skills, ai.missing_skills, ai.experience_score, ai.role_score, ai.summary as ai_summary
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN ai_scores ai ON ai.application_id = a.id
      WHERE a.job_id = ?
      ORDER BY ai.overall_fit_score DESC NULLS LAST
    `).all(jobId);

        res.json(applications.map(a => ({
            ...a,
            matched_skills: a.matched_skills ? JSON.parse(a.matched_skills) : [],
            missing_skills: a.missing_skills ? JSON.parse(a.missing_skills) : []
        })));
    } catch (err) {
        console.error('Get applications error:', err);
        res.status(500).json({ error: 'Server error fetching applications.' });
    }
};

const getMyApplications = (req, res) => {
    try {
        const applications = db.prepare(`
      SELECT a.*, j.title as job_title, j.description as job_description,
      j.required_skills, j.job_status
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.user_id = ?
      ORDER BY a.applied_at DESC
    `).all(req.user.id);

        res.json(applications.map(a => ({
            ...a,
            required_skills: a.required_skills ? JSON.parse(a.required_skills) : []
        })));
    } catch (err) {
        console.error('Get my applications error:', err);
        res.status(500).json({ error: 'Server error fetching applications.' });
    }
};

module.exports = { applyToJob, getApplicationsByJob, getMyApplications };
