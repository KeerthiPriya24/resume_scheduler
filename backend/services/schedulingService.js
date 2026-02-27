const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');
const { sendEmail, templates } = require('./emailService');

const createInterview = (applicationId, jobId) => {
  const token = uuidv4();

  const existing = db.prepare('SELECT id, scheduling_token FROM interviews WHERE application_id = ?').get(applicationId);
  if (existing) return existing;

  const result = db.prepare(`
    INSERT INTO interviews (application_id, job_id, scheduling_token)
    VALUES (?, ?, ?)
  `).run(applicationId, jobId, token);

  return { id: result.lastInsertRowid, scheduling_token: token };
};

const sendSchedulingEmails = async (jobId) => {
  const shortlisted = db.prepare(`
    SELECT a.id as application_id, a.job_id, u.name, u.email, j.title
    FROM applications a
    JOIN users u ON a.user_id = u.id
    JOIN jobs j ON a.job_id = j.id
    WHERE a.job_id = ? AND a.status = 'shortlisted'
  `).all(jobId);

  for (const candidate of shortlisted) {
    const interview = createInterview(candidate.application_id, jobId);

    db.prepare(`UPDATE applications SET status = 'scheduling' WHERE id = ?`).run(candidate.application_id);

    const { subject, html } = templates.schedulingInvite(candidate.name, candidate.title, interview.scheduling_token);
    await sendEmail(candidate.email, subject, html);

    db.prepare(`
      INSERT INTO notifications (user_id, type, subject, email_to, sent)
      VALUES ((SELECT user_id FROM applications WHERE id = ?), 'scheduling_invite', ?, ?, 1)
    `).run(candidate.application_id, subject, candidate.email);
  }

  return { sent: shortlisted.length };
};

const { parseAvailability } = require('./aiService');

const submitAvailability = async (interviewId, availability) => {
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
  if (!interview) throw new Error('Interview not found');

  let normalized = [];
  if (typeof availability === 'string' && availability.length > 5) {
    console.log(`🤖 AI Parsing availability: "${availability}"`);
    normalized = await parseAvailability(availability);
  } else {
    const slots = Array.isArray(availability) ? availability : [availability];
    normalized = slots.map(slot => {
      if (typeof slot === 'string') {
        return { datetime: slot, duration: 60 };
      }
      return slot;
    });
  }

  db.prepare(`
    UPDATE interviews SET candidate_availability = ?, interview_status = 'availability_submitted',
    negotiation_rounds = negotiation_rounds + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(normalized), interviewId);

  return { message: 'Availability submitted', slots: normalized };
};

const getMatchingSlots = (interviewId) => {
  const interview = db.prepare(`
    SELECT i.*, j.recruiter_id FROM interviews i
    JOIN jobs j ON i.job_id = j.id WHERE i.id = ?
  `).get(interviewId);
  if (!interview) return [];

  const candidateSlots = JSON.parse(interview.candidate_availability || '[]');
  const recruiterAvail = db.prepare(`
    SELECT * FROM recruiter_availability WHERE recruiter_id = ? AND is_available = 1
  `).all(interview.recruiter_id);

  if (recruiterAvail.length === 0) {
    // If recruiter hasn't set availability, treat candidate slots as proposed
    return candidateSlots.map(s => ({ ...s, match: 'proposed', source: 'candidate' }));
  }

  return candidateSlots.map(slot => {
    const slotDate = new Date(slot.datetime);
    const dayOfWeek = slotDate.getDay(); // 0 (Sun) - 6 (Sat)
    const slotTimeStr = slotDate.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"

    // Calculate end time
    const slotEndDate = new Date(slotDate.getTime() + (slot.duration || 60) * 60000);
    const slotEndTimeStr = slotEndDate.toTimeString().split(' ')[0].substring(0, 5);

    // Check for specific date match first
    const dateStr = slotDate.toISOString().split('T')[0];
    const specificDateRule = recruiterAvail.find(r => r.specific_date === dateStr);

    if (specificDateRule) {
      const isMatch = slotTimeStr >= specificDateRule.start_time && slotEndTimeStr <= specificDateRule.end_time;
      return { ...slot, match: isMatch ? 'available' : 'conflicted', source: 'specific_date' };
    }

    // Check for recurring day match
    const recurringRule = recruiterAvail.find(r => r.day_of_week === dayOfWeek && !r.specific_date);
    if (recurringRule) {
      const isMatch = slotTimeStr >= recurringRule.start_time && slotEndTimeStr <= recurringRule.end_time;
      return { ...slot, match: isMatch ? 'available' : 'conflicted', source: 'recurring' };
    }

    return { ...slot, match: 'conflicted', source: 'no_rule' };
  });
};

const bookSlot = async (interviewId, slotTime) => {
  // 1. Fetch details for the email BEFORE the transaction
  const details = db.prepare(`
    SELECT u.name, u.email, j.title as job_title
    FROM interviews i
    JOIN applications a ON i.application_id = a.id
    JOIN users u ON a.user_id = u.id
    JOIN jobs j ON i.job_id = j.id
    WHERE i.id = ?
  `).get(interviewId);

  if (!details) throw new Error('Interview details not found');

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE interviews SET selected_slot = ?, interview_status = 'confirmed',
      scheduled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(JSON.stringify(slotTime), slotTime.datetime || slotTime, interviewId);

    const interview = db.prepare(`
      SELECT i.application_id FROM interviews i WHERE i.id = ?
    `).get(interviewId);

    if (interview) {
      db.prepare(`UPDATE applications SET status = 'confirmed' WHERE id = ?`).run(interview.application_id);
    }
  });

  transaction();

  // 2. Send the confirmation email
  const formattedDate = new Date(slotTime.datetime || slotTime).toLocaleString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const { subject, html } = templates.confirmation(details.name, details.job_title, formattedDate);
  await sendEmail(details.email, subject, html);

  // 3. Record notification
  db.prepare(`
    INSERT INTO notifications (user_id, type, subject, email_to, sent)
    VALUES ((SELECT user_id FROM interviews i JOIN applications a ON i.application_id = a.id WHERE i.id = ?), 'interview_confirmation', ?, ?, 1)
  `).run(interviewId, subject, details.email);

  return { message: 'Interview booked and confirmation email sent' };
};

const getInterviewByToken = (token) => {
  return db.prepare(`
    SELECT i.*, a.user_id as candidate_id, u.name as candidate_name, j.title as job_title
    FROM interviews i
    JOIN applications a ON i.application_id = a.id
    JOIN users u ON a.user_id = u.id
    JOIN jobs j ON i.job_id = j.id
    WHERE i.scheduling_token = ?
  `).get(token);
};

module.exports = { createInterview, sendSchedulingEmails, submitAvailability, getMatchingSlots, bookSlot, getInterviewByToken };
