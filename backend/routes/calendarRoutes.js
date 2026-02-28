const express = require('express');
const { getAuthUrl, handleCallback, isConnected, getUpcomingEvents, checkConflicts } = require('../services/calendarService');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendar/status — check if calendar is connected
router.get('/status', authenticate, requireRole('recruiter'), (req, res) => {
    res.json({
        connected: isConnected(),
        message: isConnected() ? 'Google Calendar is connected' : 'Google Calendar not connected'
    });
});

// GET /api/calendar/auth — get OAuth URL to authorize
router.get('/auth', (req, res) => {
    const url = getAuthUrl();
    if (!url) {
        return res.status(500).json({ error: 'Google Calendar credentials not configured in .env' });
    }
    res.redirect(url);
});

// GET /api/calendar/callback — OAuth callback (redirected from Google)
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Missing authorization code');
    }

    try {
        await handleCallback(code);
        // Redirect to frontend with success message
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/recruiter/dashboard?calendar=connected`);
    } catch (err) {
        console.error('Calendar callback error:', err);
        res.status(500).send(`Calendar authorization failed: ${err.message}`);
    }
});

// GET /api/calendar/events — get upcoming events
router.get('/events', authenticate, requireRole('recruiter'), async (req, res) => {
    try {
        const events = await getUpcomingEvents(parseInt(req.query.limit) || 10);
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/calendar/check-conflicts — check if a time slot has conflicts
router.post('/check-conflicts', async (req, res) => {
    try {
        const { startTime, endTime } = req.body;
        if (!startTime) return res.status(400).json({ error: 'startTime is required' });

        const result = await checkConflicts(startTime, endTime);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
