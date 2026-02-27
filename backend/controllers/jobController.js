const db = require('../database/init');

// Shortlist formula: H=1→4, 2≤H≤5→H×3, H>5→H×2
function calculateShortlistTarget(positions) {
    const H = parseInt(positions) || 1;
    if (H === 1) return 4;
    if (H >= 2 && H <= 5) return H * 3;
    return H * 2;
}

const postJob = (req, res) => {
    try {
        const { title, description, required_skills, experience_required, positions, confirmation_deadline_hours } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required.' });
        }

        const H = parseInt(positions) || 1;
        const S = calculateShortlistTarget(H);
        const skills = JSON.stringify(required_skills || []);
        const exp = parseInt(experience_required) || 0;
        const deadlineMinutes = parseInt(confirmation_deadline_hours) || 1;

        const result = db.prepare(`
      INSERT INTO jobs (recruiter_id, title, description, required_skills, experience_required, positions, shortlist_target, confirmation_deadline_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, title, description, skills, exp, H, S, deadlineMinutes);

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({
            message: 'Job posted successfully',
            job: { ...job, required_skills: JSON.parse(job.required_skills) },
            shortlist_info: { positions: H, shortlist_target: S }
        });
    } catch (err) {
        console.error('Post job error:', err);
        res.status(500).json({ error: 'Server error posting job.' });
    }
};

const getAllJobs = (req, res) => {
    try {
        const { search, skills, experience } = req.query;
        let query = `SELECT j.*, u.name as recruiter_name,
            (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as application_count
                 FROM jobs j JOIN users u ON j.recruiter_id = u.id
                 WHERE j.job_status = 'open'`;
        const params = [];

        if (search) {
            query += ` AND(j.title LIKE ? OR j.description LIKE ?)`;
            params.push(`% ${search}% `, ` % ${search}% `);
        }

        query += ` ORDER BY j.created_at DESC`;
        const jobs = db.prepare(query).all(...params);

        res.json(jobs.map(j => ({ ...j, required_skills: JSON.parse(j.required_skills || '[]') })));
    } catch (err) {
        console.error('Get jobs error:', err);
        res.status(500).json({ error: 'Server error fetching jobs.' });
    }
};

const getJobById = (req, res) => {
    try {
        const job = db.prepare(`
      SELECT j.*, u.name as recruiter_name,
            (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as application_count
      FROM jobs j JOIN users u ON j.recruiter_id = u.id
      WHERE j.id = ?
            `).get(req.params.id);

        if (!job) return res.status(404).json({ error: 'Job not found.' });

        res.json({ ...job, required_skills: JSON.parse(job.required_skills || '[]') });
    } catch (err) {
        console.error('Get job error:', err);
        res.status(500).json({ error: 'Server error fetching job.' });
    }
};

const getRecruiterJobs = (req, res) => {
    try {
        const jobs = db.prepare(`
      SELECT j.*,
            (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as application_count,
                (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'shortlisted') as shortlisted_count,
                    (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'selected') as selected_count
      FROM jobs j WHERE j.recruiter_id = ?
            ORDER BY j.created_at DESC
                `).all(req.user.id);

        res.json(jobs.map(j => ({ ...j, required_skills: JSON.parse(j.required_skills || '[]') })));
    } catch (err) {
        console.error('Get recruiter jobs error:', err);
        res.status(500).json({ error: 'Server error fetching jobs.' });
    }
};

const updateJobStatus = (req, res) => {
    try {
        const { status } = req.body;
        const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?').get(req.params.id, req.user.id);
        if (!job) return res.status(404).json({ error: 'Job not found.' });

        db.prepare('UPDATE jobs SET job_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
        res.json({ message: 'Job status updated', status });
    } catch (err) {
        console.error('Update job error:', err);
        res.status(500).json({ error: 'Server error updating job.' });
    }
};

module.exports = { postJob, getAllJobs, getJobById, getRecruiterJobs, updateJobStatus, calculateShortlistTarget };
