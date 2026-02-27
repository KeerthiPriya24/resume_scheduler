const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    return transporter;
};

const sendEmail = async (to, subject, htmlBody) => {
    const transport = getTransporter();

    if (!transport) {
        // Console log fallback for development
        console.log('\n📧 [MOCK MODE] ═══════════════════════════════════');
        console.log(`📧 TO: ${to}`);
        console.log(`📧 SUBJECT: ${subject}`);
        console.log(`📧 BODY_SNIPPET: ${htmlBody.replace(/<[^>]*>/g, '').substring(0, 100)}...`);
        console.log('📧 ═══════════════════════════════════════════\n');
        return { messageId: `mock-${Date.now()}`, mock: true };
    }

    try {
        console.log(`✉️ Attempting to send real email to: ${to}...`);
        const info = await transport.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@airecruitment.com',
            to,
            subject,
            html: htmlBody
        });
        console.log(`✅ Email sent successfully! MessageId: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error(`❌ SMTP Error sending to ${to}:`, err.message);
        // Fallback to console log even on SMTP error so the demo doesn't "silently" fail
        console.log('\n📧 [SMTP FAILED - FALLBACK LOG] ════════════════');
        console.log(`📧 TO: ${to}`);
        console.log(`📧 SUBJECT: ${subject}`);
        console.log('📧 ═══════════════════════════════════════════\n');
        return { error: err.message, mock: true };
    }
};

const templates = {
    schedulingInvite: (candidateName, jobTitle, token) => ({
        subject: `Interview Scheduling - ${jobTitle}`,
        html: `
      <h2>Congratulations, ${candidateName}!</h2>
      <p>You've been shortlisted for the <strong>${jobTitle}</strong> position.</p>
      <p>Please schedule your interview using the link below:</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/schedule/${token}" 
         style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
        Schedule Interview
      </a>
    `
    }),

    confirmation: (candidateName, jobTitle, dateTime) => ({
        subject: `Interview Confirmed - ${jobTitle}`,
        html: `
      <h2>Interview Confirmed</h2>
      <p>Hi ${candidateName}, your interview for <strong>${jobTitle}</strong> is confirmed.</p>
      <p>📅 <strong>${dateTime}</strong></p>
    `
    }),

    reminder: (candidateName, jobTitle, dateTime) => ({
        subject: `Interview Reminder - ${jobTitle}`,
        html: `
      <h2>Upcoming Interview Reminder</h2>
      <p>Hi ${candidateName}, this is a reminder for your interview for <strong>${jobTitle}</strong>.</p>
      <p>📅 <strong>${dateTime}</strong></p>
    `
    })
};

module.exports = { sendEmail, templates };
