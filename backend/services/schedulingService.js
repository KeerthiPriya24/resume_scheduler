const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');
const { sendEmail, templates } = require('./emailService');

// ═══════════════════════════════════════════════════════════════════
// 1. SHORTLISTING & INVITATION (Step 1)
// ═══════════════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════════════
// 2–3. AVAILABILITY SUBMISSION + VALIDATION (Steps 2–3)
// ═══════════════════════════════════════════════════════════════════

const { parseAvailability } = require('./aiService');

const submitAvailability = async (interviewId, availability) => {
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
  if (!interview) throw new Error('Interview not found');

  // Check if already confirmed — don't allow re-submission
  if (interview.interview_status === 'confirmed') {
    throw new Error('Interview is already confirmed.');
  }

  // Step 6: Check negotiation round limit before processing
  if (interview.negotiation_rounds >= interview.max_negotiation_rounds) {
    // Escalate to recruiter
    db.prepare(`
      UPDATE interviews SET interview_status = 'escalated', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(interviewId);
    db.prepare(`
      UPDATE applications SET status = 'escalated' WHERE id = ?
    `).run(interview.application_id);
    console.log(`🚨 Interview ${interviewId} escalated: max negotiation rounds (${interview.max_negotiation_rounds}) exceeded`);
    return {
      message: 'Maximum scheduling attempts reached. A recruiter will contact you directly to arrange the interview.',
      escalated: true,
      slots: []
    };
  }

  // Step 2: LLM extraction + Step 3: Validation
  let normalized = [];
  if (typeof availability === 'string' && availability.length > 5) {
    console.log(`\n🤖 ──── Scheduling Pipeline Start ────`);
    console.log(`📝 Input: "${availability}"`);
    console.log(`🔄 Round: ${interview.negotiation_rounds + 1}/${interview.max_negotiation_rounds}`);

    normalized = await parseAvailability(availability);

    console.log(`📊 Result: ${normalized.length} validated slots`);
    normalized.forEach((s, i) => {
      const d = new Date(s.datetime);
      console.log(`   ${i + 1}. ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
    });
    console.log(`🤖 ──── Pipeline Complete ────\n`);
  } else {
    const slots = Array.isArray(availability) ? availability : [availability];
    normalized = slots.map(slot => {
      if (typeof slot === 'string') {
        return { datetime: slot, duration: 60 };
      }
      return slot;
    });
  }

  // Update interview with parsed availability
  const newStatus = normalized.length > 0 ? 'availability_submitted' : interview.interview_status;

  db.prepare(`
    UPDATE interviews SET 
      candidate_availability = ?, 
      interview_status = ?,
      negotiation_rounds = negotiation_rounds + 1, 
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(normalized), newStatus, interviewId);

  return {
    message: normalized.length > 0
      ? 'Availability processed successfully'
      : 'Could not extract availability. Please try being more specific (e.g., "Tuesday afternoon" or "next week after 2 PM").',
    slots: normalized,
    negotiation_round: interview.negotiation_rounds + 1,
    max_rounds: interview.max_negotiation_rounds
  };
};


// ═══════════════════════════════════════════════════════════════════
// 4. CALENDAR MATCHING ENGINE (Step 4)
//    - Fetch recruiter availability
//    - Compute overlap with validated candidate slots
//    - Generate best matching slots
// ═══════════════════════════════════════════════════════════════════

const getMatchingSlots = (interviewId) => {
  const interview = db.prepare(`
    SELECT i.*, j.recruiter_id FROM interviews i
    JOIN jobs j ON i.job_id = j.id WHERE i.id = ?
  `).get(interviewId);
  if (!interview) return [];

  const candidateSlots = JSON.parse(interview.candidate_availability || '[]');
  if (candidateSlots.length === 0) return [];

  const recruiterAvail = db.prepare(`
    SELECT * FROM recruiter_availability WHERE recruiter_id = ? AND is_available = 1
  `).all(interview.recruiter_id);

  // If recruiter hasn't set availability, treat all candidate slots as proposed
  if (recruiterAvail.length === 0) {
    return candidateSlots.map(s => ({
      ...s,
      match: 'proposed',
      source: 'candidate'
    }));
  }

  // Compute overlap between candidate slots and recruiter availability
  const matched = [];

  for (const slot of candidateSlots) {
    const slotDate = new Date(slot.datetime);
    const dayOfWeek = slotDate.getDay(); // 0 (Sun) - 6 (Sat)
    const slotTimeStr = slotDate.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"

    // Calculate end time
    const slotEndDate = new Date(slotDate.getTime() + (slot.duration || 60) * 60000);
    const slotEndTimeStr = slotEndDate.toTimeString().split(' ')[0].substring(0, 5);

    // Check for specific date match first (higher priority)
    const dateStr = slotDate.toISOString().split('T')[0];
    const specificDateRule = recruiterAvail.find(r => r.specific_date === dateStr);

    if (specificDateRule) {
      const isMatch = slotTimeStr >= specificDateRule.start_time && slotEndTimeStr <= specificDateRule.end_time;
      matched.push({
        ...slot,
        match: isMatch ? 'available' : 'conflicted',
        source: 'specific_date'
      });
      continue;
    }

    // Check for recurring day-of-week match
    const recurringRule = recruiterAvail.find(r => r.day_of_week === dayOfWeek && !r.specific_date);
    if (recurringRule) {
      const isMatch = slotTimeStr >= recurringRule.start_time && slotEndTimeStr <= recurringRule.end_time;
      matched.push({
        ...slot,
        match: isMatch ? 'available' : 'conflicted',
        source: 'recurring'
      });
      continue;
    }

    matched.push({ ...slot, match: 'conflicted', source: 'no_rule' });
  }

  // Sort: available first, then by datetime
  return matched.sort((a, b) => {
    if (a.match === 'available' && b.match !== 'available') return -1;
    if (a.match !== 'available' && b.match === 'available') return 1;
    return new Date(a.datetime) - new Date(b.datetime);
  });
};


// ═══════════════════════════════════════════════════════════════════
// 5. SLOT BOOKING (Step 5)
//    - Lock slot
//    - Update interview status
//    - Send confirmation email
// ═══════════════════════════════════════════════════════════════════

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

  // Check for double-booking
  const existing = db.prepare('SELECT id FROM interviews WHERE id = ? AND interview_status = ?').get(interviewId, 'confirmed');
  if (existing) throw new Error('This interview is already booked.');

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

  console.log(`✅ Interview ${interviewId} booked: ${formattedDate}`);
  return { message: 'Interview booked and confirmation email sent' };
};


// ═══════════════════════════════════════════════════════════════════
// TOKEN LOOKUP
// ═══════════════════════════════════════════════════════════════════

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


module.exports = {
  createInterview,
  sendSchedulingEmails,
  submitAvailability,
  getMatchingSlots,
  bookSlot,
  getInterviewByToken
};
