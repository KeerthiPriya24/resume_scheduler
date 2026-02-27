const db = require('../database/init');
const { submitAvailability, getMatchingSlots, bookSlot, getInterviewByToken } = require('../services/schedulingService');

const getInterviewsByJob = (req, res) => {
    try {
        const interviews = db.prepare(`
      SELECT i.*, a.status as application_status, u.name as candidate_name, u.email as candidate_email
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN users u ON a.user_id = u.id
      WHERE i.job_id = ?
      ORDER BY i.created_at DESC
    `).all(req.params.jobId);

        res.json(interviews.map(i => ({
            ...i,
            candidate_availability: JSON.parse(i.candidate_availability || '[]'),
            selected_slot: i.selected_slot ? JSON.parse(i.selected_slot) : null
        })));
    } catch (err) {
        console.error('Get interviews error:', err);
        res.status(500).json({ error: 'Server error fetching interviews.' });
    }
};

const getByToken = (req, res) => {
    try {
        const interview = getInterviewByToken(req.params.token);
        if (!interview) return res.status(404).json({ error: 'Interview not found.' });
        res.json({
            ...interview,
            candidate_availability: JSON.parse(interview.candidate_availability || '[]')
        });
    } catch (err) {
        console.error('Get interview by token error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const postAvailability = async (req, res) => {
    try {
        const { availability } = req.body;
        const result = await submitAvailability(parseInt(req.params.interviewId), availability);
        res.json(result);
    } catch (err) {
        console.error('Submit availability error:', err);
        res.status(500).json({ error: err.message || 'Server error.' });
    }
};

const getSlots = (req, res) => {
    try {
        const slots = getMatchingSlots(parseInt(req.params.interviewId));
        res.json(slots);
    } catch (err) {
        console.error('Get slots error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const book = async (req, res) => {
    try {
        const { slot } = req.body;
        const result = await bookSlot(parseInt(req.params.interviewId), slot);
        res.json(result);
    } catch (err) {
        console.error('Book slot error:', err);
        res.status(500).json({ error: err.message || 'Server error.' });
    }
};

const makeDecision = (req, res) => {
    try {
        const { decision } = req.body; // 'selected', 'rejected', 'hold'
        const interviewId = parseInt(req.params.interviewId);

        const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
        if (!interview) return res.status(404).json({ error: 'Interview not found.' });

        db.prepare(`UPDATE interviews SET interview_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(interviewId);
        db.prepare(`UPDATE applications SET status = ? WHERE id = ?`).run(decision, interview.application_id);

        // Check if we've filled all positions
        if (decision === 'selected') {
            const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(interview.job_id);
            const selectedCount = db.prepare(`
        SELECT COUNT(*) as count FROM applications WHERE job_id = ? AND status = 'selected'
      `).get(interview.job_id);

            if (selectedCount.count >= job.positions) {
                db.prepare(`UPDATE jobs SET job_status = 'filled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(interview.job_id);
                return res.json({ message: `Decision recorded. All ${job.positions} positions filled! Job closed.`, job_closed: true });
            }
        }

        res.json({ message: 'Decision recorded', decision });
    } catch (err) {
        console.error('Decision error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

const setRecruiterAvailability = (req, res) => {
    try {
        const { slots } = req.body;

        // Clear existing availability for this recruiter
        db.prepare('DELETE FROM recruiter_availability WHERE recruiter_id = ?').run(req.user.id);

        const insert = db.prepare(`
      INSERT INTO recruiter_availability (recruiter_id, day_of_week, start_time, end_time, specific_date, is_available)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

        for (const slot of slots) {
            insert.run(req.user.id, slot.day_of_week, slot.start_time, slot.end_time, slot.specific_date || null);
        }

        res.json({ message: 'Availability updated', count: slots.length });
    } catch (err) {
        console.error('Set availability error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
};

module.exports = { getInterviewsByJob, getByToken, postAvailability, getSlots, book, makeDecision, setRecruiterAvailability };
