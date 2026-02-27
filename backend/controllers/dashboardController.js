const db = require('../database/init');

const getRecruiterStats = (req, res) => {
    try {
        const stats = {
            total_jobs: db.prepare('SELECT COUNT(*) as count FROM jobs WHERE recruiter_id = ?').get(req.user.id).count,
            open_jobs: db.prepare("SELECT COUNT(*) as count FROM jobs WHERE recruiter_id = ? AND job_status = 'open'").get(req.user.id).count,
            filled_jobs: db.prepare("SELECT COUNT(*) as count FROM jobs WHERE recruiter_id = ? AND job_status = 'filled'").get(req.user.id).count,
            total_applications: db.prepare(`
        SELECT COUNT(*) as count FROM applications a
        JOIN jobs j ON a.job_id = j.id WHERE j.recruiter_id = ?
      `).get(req.user.id).count,
            shortlisted: db.prepare(`
        SELECT COUNT(*) as count FROM applications a
        JOIN jobs j ON a.job_id = j.id WHERE j.recruiter_id = ? AND a.status IN ('shortlisted', 'scheduling', 'confirmed')
      `).get(req.user.id).count,
            interviews_scheduled: db.prepare(`
        SELECT COUNT(*) as count FROM interviews i
        JOIN jobs j ON i.job_id = j.id WHERE j.recruiter_id = ? AND i.interview_status = 'confirmed'
      `).get(req.user.id).count,
            selected: db.prepare(`
        SELECT COUNT(*) as count FROM applications a
        JOIN jobs j ON a.job_id = j.id WHERE j.recruiter_id = ? AND a.status = 'selected'
      `).get(req.user.id).count
        };

        res.json(stats);
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const getPipeline = (req, res) => {
    try {
        const { jobId } = req.params;
        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
        if (!job) return res.status(404).json({ error: 'Job not found.' });

        const pipeline = {
            job: { ...job, required_skills: JSON.parse(job.required_skills || '[]') },
            counts: {
                total_applications: db.prepare('SELECT COUNT(*) as c FROM applications WHERE job_id = ?').get(jobId).c,
                pending_ai: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status = 'pending_ai_processing'").get(jobId).c,
                processed: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status = 'processed'").get(jobId).c,
                pending_confirmation: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status = 'pending_confirmation'").get(jobId).c,
                shortlisted: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status IN ('shortlisted', 'scheduling', 'confirmed')").get(jobId).c,
                buffer: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status = 'buffer'").get(jobId).c,
                interviews: db.prepare("SELECT COUNT(*) as c FROM interviews WHERE job_id = ? AND interview_status = 'confirmed'").get(jobId).c,
                selected: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status = 'selected'").get(jobId).c,
                rejected: db.prepare("SELECT COUNT(*) as c FROM applications WHERE job_id = ? AND status = 'rejected'").get(jobId).c
            },
            shortlist: db.prepare('SELECT * FROM shortlists WHERE job_id = ? ORDER BY proposed_at DESC LIMIT 1').get(jobId)
        };

        res.json(pipeline);
    } catch (err) {
        console.error('Pipeline error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const closeJob = (req, res) => {
    try {
        const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?').get(req.params.jobId, req.user.id);
        if (!job) return res.status(404).json({ error: 'Job not found.' });

        db.prepare(`UPDATE jobs SET job_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.jobId);
        res.json({ message: 'Job closed' });
    } catch (err) {
        console.error('Close job error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const getRecruiterInterviews = (req, res) => {
    try {
        const interviews = db.prepare(`
      SELECT i.*, a.status as application_status, u.name as candidate_name, u.email as candidate_email, j.title as job_title
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN jobs j ON i.job_id = j.id
      WHERE j.recruiter_id = ? AND i.interview_status = 'confirmed'
      ORDER BY i.scheduled_at ASC
    `).all(req.user.id);

        res.json(interviews.map(i => ({
            ...i,
            selected_slot: i.selected_slot ? JSON.parse(i.selected_slot) : null
        })));
    } catch (err) {
        console.error('Get recruiter interviews error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const getJobSeekerInterviews = (req, res) => {
    try {
        const interviews = db.prepare(`
      SELECT i.*, j.title as job_title, j.recruiter_id, u.name as recruiter_name
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN jobs j ON i.job_id = j.id
      JOIN users u ON j.recruiter_id = u.id
      WHERE a.user_id = ? AND i.interview_status = 'confirmed'
      ORDER BY i.scheduled_at ASC
    `).all(req.user.id);

        res.json(interviews.map(i => ({
            ...i,
            selected_slot: i.selected_slot ? JSON.parse(i.selected_slot) : null
        })));
    } catch (err) {
        console.error('Get jobseeker interviews error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const getRecruiterAvailability = (req, res) => {
    try {
        const availability = db.prepare(`
            SELECT id, day_of_week, start_time, end_time, specific_date 
            FROM recruiter_availability 
            WHERE recruiter_id = ? AND is_available = 1
        `).all(req.user.id);
        res.json(availability);
    } catch (err) {
        console.error('Get availability error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

module.exports = { getRecruiterStats, getPipeline, closeJob, getRecruiterInterviews, getJobSeekerInterviews, getRecruiterAvailability };
