const db = require('../database/init');
const { rankCandidates } = require('./rankingService');

const proposeShortlist = (jobId) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw new Error('Job not found');

  const hiredCount = db.prepare(`SELECT COUNT(*) as count FROM applications WHERE job_id = ? AND status = 'selected'`).get(jobId).count;
  const vacancies = job.positions - hiredCount;
  if (vacancies <= 0) return { message: 'Job is already filled or closed', status: 'filled' };

  // Calculate Dynamic Target S based on remaining vacancies
  let S_target = 0;
  if (vacancies === 1) S_target = 4;
  else if (vacancies <= 5) S_target = vacancies * 3;
  else S_target = vacancies * 2;

  // Count how many are already in the pipeline (shortlisted or further)
  const inPipeline = db.prepare(`
        SELECT COUNT(*) as count FROM applications 
        WHERE job_id = ? AND status IN ('pending_confirmation', 'shortlisted', 'scheduling', 'confirmed')
    `).get(jobId).count;

  const gap = Math.max(0, S_target - inPipeline);
  if (gap === 0) {
    return { message: 'Pipeline is already at capacity for remaining vacancies', shortlisted: [], shortlist_target: S_target };
  }

  // Only pick candidates who are 'processed' (AI scored) and not yet in the pipeline
  const candidates = db.prepare(`
        SELECT a.id as application_id, ai.overall_fit_score
        FROM applications a
        JOIN ai_scores ai ON ai.application_id = a.id
        WHERE a.job_id = ? AND a.status IN ('processed', 'ranked', 'buffer')
        ORDER BY ai.overall_fit_score DESC
        LIMIT ?
    `).all(jobId, gap);

  if (candidates.length === 0) {
    return { message: 'No new processed candidates available to add to shortlist', shortlisted: [] };
  }

  // Update statuses to pending_confirmation
  const updateStmt = db.prepare('UPDATE applications SET status = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    for (const c of candidates) {
      updateStmt.run('pending_confirmation', c.application_id);
    }

    // Handle existing proposed shortlists - either update or create new record
    const existingProposed = db.prepare(`SELECT id FROM shortlists WHERE job_id = ? AND status = 'proposed'`).get(jobId);

    const deadlineDate = new Date();
    deadlineDate.setMinutes(deadlineDate.getMinutes() + job.confirmation_deadline_hours);

    if (existingProposed) {
      db.prepare(`UPDATE shortlists SET confirmation_deadline = ?, proposed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(deadlineDate.toISOString(), existingProposed.id);
    } else {
      db.prepare(`
              INSERT INTO shortlists (job_id, status, confirmation_deadline)
              VALUES (?, 'proposed', ?)
            `).run(jobId, deadlineDate.toISOString());
    }
  });

  transaction();

  return {
    message: `Added ${candidates.length} new candidates to the confirmation queue.`,
    shortlisted_count: candidates.length,
    shortlist_target: S_target
  };
};

const confirmShortlist = (jobId) => {
  const transaction = db.transaction(() => {
    // Move pending_confirmation → shortlisted
    db.prepare(`
      UPDATE applications SET status = 'shortlisted' WHERE job_id = ? AND status = 'pending_confirmation'
    `).run(jobId);

    // Update shortlist record
    db.prepare(`
      UPDATE shortlists SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
      WHERE job_id = ? AND status = 'proposed'
    `).run(jobId);
  });

  transaction();

  const shortlisted = db.prepare(`
    SELECT a.*, u.name as candidate_name, u.email as candidate_email
    FROM applications a JOIN users u ON a.user_id = u.id
    WHERE a.job_id = ? AND a.status = 'shortlisted'
  `).all(jobId);

  return { message: 'Shortlist confirmed', shortlisted };
};

const removeCandidate = (jobId, applicationId) => {
  db.prepare(`UPDATE applications SET status = 'rejected' WHERE id = ? AND job_id = ?`).run(applicationId, jobId);
  return promoteFromBuffer(jobId);
};

const promoteFromBuffer = (jobId) => {
  // Get the single highest scoring candidate who is not yet in the interview flow
  const next = db.prepare(`
    SELECT a.id FROM applications a
    LEFT JOIN ai_scores ai ON ai.application_id = a.id
    WHERE a.job_id = ? AND a.status IN ('buffer', 'processed', 'ranked')
    ORDER BY ai.overall_fit_score DESC
    LIMIT 1
  `).get(jobId);

  if (next) {
    db.prepare(`UPDATE applications SET status = 'shortlisted' WHERE id = ?`).run(next.id);
    return { promoted: next.id, message: 'Next best candidate promoted to shortlist' };
  }

  return { promoted: null, message: 'No more qualified candidates available in pool' };
};

const getShortlistStatus = (jobId) => {
  const shortlist = db.prepare('SELECT * FROM shortlists WHERE job_id = ? ORDER BY proposed_at DESC LIMIT 1').get(jobId);
  const shortlisted = db.prepare(`
    SELECT a.*, u.name as candidate_name, u.email as candidate_email,
    ai.overall_fit_score, ai.matched_skills, ai.summary
    FROM applications a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN ai_scores ai ON ai.application_id = a.id
    WHERE a.job_id = ? AND a.status IN ('pending_confirmation', 'shortlisted')
    ORDER BY ai.overall_fit_score DESC
  `).all(jobId);

  const buffer = db.prepare(`
    SELECT a.*, u.name as candidate_name, u.email as candidate_email,
    ai.overall_fit_score
    FROM applications a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN ai_scores ai ON ai.application_id = a.id
    WHERE a.job_id = ? AND a.status = 'buffer'
    ORDER BY ai.overall_fit_score DESC
  `).all(jobId);

  return {
    shortlist,
    shortlisted: shortlisted.map(s => ({
      ...s,
      matched_skills: s.matched_skills ? JSON.parse(s.matched_skills) : []
    })),
    buffer
  };
};

const shortlistIndividual = async (applicationId) => {
  const application = db.prepare(`
    SELECT a.*, u.name as candidate_name, u.email as candidate_email, j.title as job_title
    FROM applications a 
    JOIN users u ON a.user_id = u.id
    JOIN jobs j ON a.job_id = j.id
    WHERE a.id = ?
  `).get(applicationId);

  if (!application) throw new Error('Application not found');

  db.prepare(`UPDATE applications SET status = 'shortlisted' WHERE id = ?`).run(applicationId);

  // Return application details for immediate email triggering
  return { application };
};

const shortlistIndividualCandidateInternal = async (applicationId) => {
  const application = db.prepare(`
    SELECT a.*, u.name as candidate_name, u.email as candidate_email, j.title as job_title
    FROM applications a 
    JOIN users u ON a.user_id = u.id
    JOIN jobs j ON a.job_id = j.id
    WHERE a.id = ?
  `).get(applicationId);

  if (!application) return;

  db.prepare(`UPDATE applications SET status = 'shortlisted' WHERE id = ?`).run(applicationId);

  // Trigger scheduling email
  const { createInterview } = require('./schedulingService');
  const { sendEmail, templates } = require('./emailService');

  const interview = createInterview(application.id, application.job_id);

  const { subject, html } = templates.schedulingInvite(application.candidate_name, application.job_title, interview.scheduling_token);
  await sendEmail(application.candidate_email, subject, html);
};

module.exports = { proposeShortlist, confirmShortlist, removeCandidate, promoteFromBuffer, getShortlistStatus, shortlistIndividual, shortlistIndividualCandidateInternal };
