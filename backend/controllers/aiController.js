const db = require('../database/init');
const { analyzeResume } = require('../services/aiService');
const { extractText } = require('../services/resumeParser');

const processApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const app = db.prepare(`
      SELECT a.*, j.description as job_description, j.required_skills
      FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?
    `).get(applicationId);

        if (!app) return res.status(404).json({ error: 'Application not found.' });

        // Extract resume text if not already done
        let resumeText = app.resume_text;
        if ((!resumeText || resumeText.trim() === '') && app.resume_path) {
            resumeText = await extractText(app.resume_path);
            if (resumeText) {
                db.prepare('UPDATE applications SET resume_text = ? WHERE id = ?').run(resumeText, applicationId);
            }
        }

        // AI analysis
        const skills = JSON.parse(app.required_skills || '[]');
        const aiResult = await analyzeResume(app.job_description, skills, resumeText || '');

        // Store AI scores
        const existing = db.prepare('SELECT id FROM ai_scores WHERE application_id = ?').get(applicationId);
        if (existing) {
            db.prepare(`
        UPDATE ai_scores SET matched_skills = ?, missing_skills = ?, experience_score = ?,
        role_score = ?, overall_fit_score = ?, summary = ?, processed_at = CURRENT_TIMESTAMP
        WHERE application_id = ?
      `).run(
                JSON.stringify(aiResult.matched_skills), JSON.stringify(aiResult.missing_skills),
                aiResult.experience_score, aiResult.role_score, aiResult.overall_fit_score,
                aiResult.summary, applicationId
            );
        } else {
            db.prepare(`
        INSERT INTO ai_scores (application_id, matched_skills, missing_skills, experience_score, role_score, overall_fit_score, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
                applicationId, JSON.stringify(aiResult.matched_skills), JSON.stringify(aiResult.missing_skills),
                aiResult.experience_score, aiResult.role_score, aiResult.overall_fit_score, aiResult.summary
            );
        }

        // Update application status
        db.prepare(`UPDATE applications SET status = 'processed' WHERE id = ?`).run(applicationId);

        res.json({ message: 'Application processed', scores: aiResult });
    } catch (err) {
        console.error('Process application error:', err);
        res.status(500).json({ error: 'Server error processing application.' });
    }
};

const processAllForJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?').get(jobId, req.user.id);
        if (!job) return res.status(404).json({ error: 'Job not found.' });

        const pending = db.prepare(`
      SELECT id FROM applications WHERE job_id = ? AND status = 'pending_ai_processing'
    `).all(jobId);

        const results = [];
        for (const app of pending) {
            try {
                const appData = db.prepare(`
          SELECT a.*, j.description as job_description, j.required_skills
          FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?
        `).get(app.id);

                let resumeText = appData.resume_text;
                if ((!resumeText || resumeText.trim() === '') && appData.resume_path) {
                    resumeText = await extractText(appData.resume_path);
                    if (resumeText) {
                        db.prepare('UPDATE applications SET resume_text = ? WHERE id = ?').run(resumeText, app.id);
                    }
                }

                const skills = JSON.parse(appData.required_skills || '[]');
                const aiResult = await analyzeResume(appData.job_description, skills, resumeText || '');

                db.prepare(`
          INSERT OR REPLACE INTO ai_scores (application_id, matched_skills, missing_skills, experience_score, role_score, overall_fit_score, summary)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
                    app.id, JSON.stringify(aiResult.matched_skills), JSON.stringify(aiResult.missing_skills),
                    aiResult.experience_score, aiResult.role_score, aiResult.overall_fit_score, aiResult.summary
                );

                db.prepare(`UPDATE applications SET status = 'processed' WHERE id = ?`).run(app.id);
                results.push({ applicationId: app.id, status: 'processed', scores: aiResult });
            } catch (e) {
                results.push({ applicationId: app.id, status: 'error', error: e.message });
            }
        }

        res.json({ message: `Processed ${results.length} applications`, results });
    } catch (err) {
        console.error('Process all error:', err);
        res.status(500).json({ error: 'Server error processing applications.' });
    }
};

const getScores = (req, res) => {
    try {
        const { jobId } = req.params;
        const scores = db.prepare(`
      SELECT a.id as application_id, u.name as candidate_name, u.email,
      ai.matched_skills, ai.missing_skills, ai.experience_score, ai.role_score, ai.overall_fit_score, ai.summary,
      a.status
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN ai_scores ai ON ai.application_id = a.id
      WHERE a.job_id = ?
      ORDER BY ai.overall_fit_score DESC NULLS LAST
    `).all(jobId);

        res.json(scores.map(s => ({
            ...s,
            matched_skills: s.matched_skills ? JSON.parse(s.matched_skills) : [],
            missing_skills: s.missing_skills ? JSON.parse(s.missing_skills) : []
        })));
    } catch (err) {
        console.error('Get scores error:', err);
        res.status(500).json({ error: 'Server error fetching scores.' });
    }
};

module.exports = { processApplication, processAllForJob, getScores };
