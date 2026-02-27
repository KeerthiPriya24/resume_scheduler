const db = require('../database/init');

const rankCandidates = (jobId) => {
    const candidates = db.prepare(`
    SELECT a.id as application_id, a.user_id, a.status, u.name as candidate_name,
    ai.overall_fit_score, ai.experience_score, ai.role_score, ai.matched_skills, ai.missing_skills, ai.summary
    FROM applications a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN ai_scores ai ON ai.application_id = a.id
    WHERE a.job_id = ? AND a.status IN ('processed', 'ranked', 'pending_confirmation', 'shortlisted', 'buffer')
    ORDER BY ai.overall_fit_score DESC NULLS LAST
  `).all(jobId);

    // Assign ranks
    return candidates.map((c, idx) => ({
        ...c,
        rank: idx + 1,
        matched_skills: c.matched_skills ? JSON.parse(c.matched_skills) : [],
        missing_skills: c.missing_skills ? JSON.parse(c.missing_skills) : []
    }));
};

const getTopNCandidates = (jobId, n) => {
    const ranked = rankCandidates(jobId);
    return { top: ranked.slice(0, n), buffer: ranked.slice(n) };
};

module.exports = { rankCandidates, getTopNCandidates };
