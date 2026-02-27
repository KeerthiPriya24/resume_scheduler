const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════
// Google Calendar Integration
// - OAuth2 flow for recruiter authorization
// - Create calendar events for confirmed interviews
// - Check for conflicting meetings (freebusy query)
// ═══════════════════════════════════════════════════════════════════

const TOKEN_PATH = path.join(__dirname, '..', 'data', 'google-tokens.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const getOAuth2Client = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/calendar/callback';

    if (!clientId || !clientSecret) {
        console.log('⚠️ Google Calendar: Missing CLIENT_ID or CLIENT_SECRET');
        return null;
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

// ─── Get stored tokens ────────────────────────────────────────────
const getStoredTokens = () => {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const data = fs.readFileSync(TOKEN_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading tokens:', err.message);
    }
    return null;
};

// ─── Save tokens ──────────────────────────────────────────────────
const saveTokens = (tokens) => {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('✅ Google Calendar tokens saved');
};

// ─── Get authenticated client ─────────────────────────────────────
const getAuthenticatedClient = () => {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) return null;

    const tokens = getStoredTokens();
    if (!tokens) {
        console.log('⚠️ Google Calendar: No tokens stored. Recruiter needs to authorize.');
        return null;
    }

    oauth2Client.setCredentials(tokens);

    // Auto-refresh token
    oauth2Client.on('tokens', (newTokens) => {
        const merged = { ...tokens, ...newTokens };
        saveTokens(merged);
        console.log('🔄 Google Calendar: Token refreshed');
    });

    return oauth2Client;
};

// ─── Generate Auth URL ────────────────────────────────────────────
const getAuthUrl = () => {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) return null;

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
        ]
    });
};

// ─── Handle OAuth callback ────────────────────────────────────────
const handleCallback = async (code) => {
    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) throw new Error('OAuth2 client not configured');

    const { tokens } = await oauth2Client.getToken(code);
    saveTokens(tokens);
    oauth2Client.setCredentials(tokens);

    return { message: 'Google Calendar connected successfully' };
};

// ─── Check connection status ──────────────────────────────────────
const isConnected = () => {
    const tokens = getStoredTokens();
    return !!tokens;
};


// ═══════════════════════════════════════════════════════════════════
// CALENDAR OPERATIONS
// ═══════════════════════════════════════════════════════════════════

// ─── Check for conflicts (FreeBusy query) ─────────────────────────
const checkConflicts = async (startTime, endTime) => {
    const auth = getAuthenticatedClient();
    if (!auth) {
        console.log('📅 Calendar not connected — skipping conflict check');
        return { hasConflict: false, conflicts: [], connected: false };
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth });

        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour

        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                items: [{ id: 'primary' }]
            }
        });

        const busy = response.data.calendars?.primary?.busy || [];

        if (busy.length > 0) {
            console.log(`⚠️ Calendar conflict found: ${busy.length} existing event(s) in slot`);
            return {
                hasConflict: true,
                conflicts: busy.map(b => ({
                    start: b.start,
                    end: b.end
                })),
                connected: true
            };
        }

        console.log(`✅ Calendar: No conflicts for ${start.toLocaleString()}`);
        return { hasConflict: false, conflicts: [], connected: true };

    } catch (err) {
        console.error('Calendar conflict check error:', err.message);
        return { hasConflict: false, conflicts: [], connected: true, error: err.message };
    }
};


// ─── Create calendar event ────────────────────────────────────────
const createCalendarEvent = async ({ candidateName, candidateEmail, jobTitle, startTime, duration = 60 }) => {
    const auth = getAuthenticatedClient();
    if (!auth) {
        console.log('📅 Calendar not connected — skipping event creation');
        return { created: false, reason: 'not_connected' };
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth });

        const start = new Date(startTime);
        const end = new Date(start.getTime() + duration * 60 * 1000);

        const event = {
            summary: `Interview: ${candidateName} — ${jobTitle}`,
            description: [
                `Candidate: ${candidateName}`,
                `Position: ${jobTitle}`,
                ``,
                `This interview was scheduled automatically by RecruitAI.`,
            ].join('\n'),
            start: {
                dateTime: start.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: end.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            attendees: candidateEmail ? [{ email: candidateEmail }] : [],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                ],
            },
            colorId: '9', // Blueberry — stands out for interviews
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendUpdates: candidateEmail ? 'all' : 'none', // Send invite to candidate
        });

        console.log(`✅ Calendar event created: ${response.data.htmlLink}`);
        return {
            created: true,
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            start: response.data.start,
            end: response.data.end
        };

    } catch (err) {
        console.error('Calendar event creation error:', err.message);
        return { created: false, error: err.message };
    }
};


// ─── Get upcoming events (for recruiter dashboard) ────────────────
const getUpcomingEvents = async (maxResults = 10) => {
    const auth = getAuthenticatedClient();
    if (!auth) return [];

    try {
        const calendar = google.calendar({ version: 'v3', auth });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return (response.data.items || []).map(event => ({
            id: event.id,
            summary: event.summary,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            attendees: (event.attendees || []).map(a => a.email),
            htmlLink: event.htmlLink,
        }));

    } catch (err) {
        console.error('Get upcoming events error:', err.message);
        return [];
    }
};


module.exports = {
    getAuthUrl,
    handleCallback,
    isConnected,
    checkConflicts,
    createCalendarEvent,
    getUpcomingEvents,
    getAuthenticatedClient
};
