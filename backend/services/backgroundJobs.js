const cron = require('node-cron');
const db = require('../database/init');
const { confirmShortlist, promoteFromBuffer } = require('./shortlistService');
const { sendSchedulingEmails } = require('./schedulingService');

const startBackgroundJobs = () => {
    console.log('🔄 Background jobs started');

    // Every 1 minute: Check confirmation deadlines → auto-confirm
    cron.schedule('* * * * *', () => {
        try {
            const expired = db.prepare(`
        SELECT s.job_id FROM shortlists s
        WHERE s.status = 'proposed' AND s.confirmation_deadline < datetime('now')
      `).all();

            for (const { job_id } of expired) {
                console.log(`⏰ Auto-confirming shortlist for job ${job_id}`);
                confirmShortlist(job_id);

                // Update shortlist status to auto_confirmed
                db.prepare(`
          UPDATE shortlists SET status = 'auto_confirmed' WHERE job_id = ? AND status = 'confirmed'
        `).run(job_id);

                // Send scheduling emails
                sendSchedulingEmails(job_id).catch(err => {
                    console.error(`Failed to send scheduling emails for job ${job_id}:`, err);
                });
            }
        } catch (err) {
            console.error('Auto-confirm job error:', err);
        }
    });

    // Every hour: Check scheduling timeouts → escalate
    cron.schedule('0 * * * *', () => {
        try {
            const stale = db.prepare(`
        SELECT i.id, i.application_id, i.negotiation_rounds, i.max_negotiation_rounds
        FROM interviews i
        WHERE i.interview_status = 'availability_submitted'
        AND i.negotiation_rounds >= i.max_negotiation_rounds
      `).all();

            for (const interview of stale) {
                console.log(`🚨 Escalating interview ${interview.id}`);
                db.prepare(`
          UPDATE interviews SET interview_status = 'escalated', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(interview.id);
                db.prepare(`
          UPDATE applications SET status = 'escalated' WHERE id = ?
        `).run(interview.application_id);
            }
        } catch (err) {
            console.error('Scheduling timeout check error:', err);
        }
    });

    // Every 1 minute: Auto-shortlist processed candidates (older than 1 min)
    cron.schedule('* * * * *', async () => {
        try {
            // Find candidates in 'processed' or 'ranked' who applied/were processed more than 1 minute ago
            const candidates = db.prepare(`
                SELECT a.id, a.job_id FROM applications a
                JOIN ai_scores ai ON ai.application_id = a.id
                WHERE a.status IN ('processed', 'ranked')
                AND ai.processed_at < datetime('now', '-1 minute')
            `).all();

            for (const c of candidates) {
                console.log(`🤖 Auto-shortlisting candidate ${c.id} for job ${c.job_id}`);
                try {
                    const { shortlistIndividualCandidateInternal } = require('./shortlistService');
                    await shortlistIndividualCandidateInternal(c.id);
                } catch (err) {
                    console.error(`Auto-shortlist failure for candidate ${c.id}:`, err);
                }
            }
        } catch (err) {
            console.error('Auto-shortlist cron error:', err);
        }
    });

    // Every 1 minute: Buffer promotion check
    cron.schedule('* * * * *', () => {
        try {
            const jobs = db.prepare(`
        SELECT j.id, j.shortlist_target,
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'shortlisted') as current_shortlisted
        FROM jobs j WHERE j.job_status = 'open'
      `).all();

            for (const job of jobs) {
                if (job.current_shortlisted < job.shortlist_target) {
                    const deficit = job.shortlist_target - job.current_shortlisted;
                    for (let i = 0; i < deficit; i++) {
                        const result = promoteFromBuffer(job.id);
                        if (!result.promoted) break;
                        console.log(`📈 Promoted buffer candidate for job ${job.id}`);
                    }
                }
            }
        } catch (err) {
            console.error('Buffer promotion check error:', err);
        }
    });

    console.log('✅ Demo Mode Cron Registered (1-minute intervals)');
};

module.exports = { startBackgroundJobs };
