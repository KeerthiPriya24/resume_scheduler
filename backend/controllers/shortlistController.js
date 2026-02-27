const { proposeShortlist, confirmShortlist, removeCandidate, getShortlistStatus, shortlistIndividual } = require('../services/shortlistService');
const { sendSchedulingEmails } = require('../services/schedulingService');

const propose = (req, res) => {
    try {
        const result = proposeShortlist(parseInt(req.params.jobId));
        res.json(result);
    } catch (err) {
        console.error('Propose shortlist error:', err);
        res.status(500).json({ error: err.message || 'Server error proposing shortlist.' });
    }
};

const confirm = async (req, res) => {
    try {
        const result = confirmShortlist(parseInt(req.params.jobId));

        // Send scheduling emails to shortlisted candidates
        try {
            const emailResult = await sendSchedulingEmails(parseInt(req.params.jobId));
            result.emails_sent = emailResult.sent;
        } catch (e) {
            result.email_error = e.message;
        }

        res.json(result);
    } catch (err) {
        console.error('Confirm shortlist error:', err);
        res.status(500).json({ error: err.message || 'Server error confirming shortlist.' });
    }
};

const remove = (req, res) => {
    try {
        const result = removeCandidate(parseInt(req.params.jobId), parseInt(req.params.applicationId));
        res.json(result);
    } catch (err) {
        console.error('Remove candidate error:', err);
        res.status(500).json({ error: err.message || 'Server error removing candidate.' });
    }
};

const getStatus = (req, res) => {
    try {
        const result = getShortlistStatus(parseInt(req.params.jobId));
        res.json(result);
    } catch (err) {
        console.error('Get shortlist status error:', err);
        res.status(500).json({ error: err.message || 'Server error fetching shortlist.' });
    }
};

const shortlistIndividualCandidate = async (req, res) => {
    try {
        const { application } = await shortlistIndividual(parseInt(req.params.applicationId));

        // Trigger scheduling email
        const { createInterview } = require('../services/schedulingService');
        const { sendEmail, templates } = require('../services/emailService');

        const interview = createInterview(application.id, application.job_id);

        const { subject, html } = templates.schedulingInvite(application.name || application.candidate_name, application.job_title, interview.scheduling_token);
        await sendEmail(application.email || application.candidate_email, subject, html);

        res.json({ message: 'Candidate shortlisted and interview invite sent', applicationId: req.params.applicationId });
    } catch (err) {
        console.error('Shortlist individual error:', err);
        res.status(500).json({ error: err.message || 'Server error shortlisting candidate.' });
    }
};

module.exports = { propose, confirm, remove, getStatus, shortlistIndividualCandidate };
