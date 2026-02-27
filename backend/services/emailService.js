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
      from: process.env.EMAIL_FROM || '"RecruitAI" <noreply@recruitai.com>',
      to,
      subject,
      html: htmlBody
    });
    console.log(`✅ Email sent successfully! MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ SMTP Error sending to ${to}:`, err.message);
    console.log('\n📧 [SMTP FAILED - FALLBACK LOG] ════════════════');
    console.log(`📧 TO: ${to}`);
    console.log(`📧 SUBJECT: ${subject}`);
    console.log('📧 ═══════════════════════════════════════════\n');
    return { error: err.message, mock: true };
  }
};

// ─── Shared Email Layout ──────────────────────────────────────────
const emailLayout = (content) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>RecruitAI</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;line-height:1.6;-webkit-font-smoothing:antialiased;">

  <!-- Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Logo area -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
          <tr>
            <td align="left" style="padding:0 0 0 4px;">
              <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">Recruit</span><span style="font-size:18px;font-weight:700;color:#4f46e5;letter-spacing:-0.5px;">AI</span>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
          <tr>
            <td style="padding:36px 40px 32px;">
              ${content}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding:20px 4px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#a1a1aa;">
                Sent by RecruitAI &mdash; AI-Powered Recruitment Platform
              </p>
              <p style="margin:0;font-size:11px;color:#d4d4d8;">
                &copy; ${new Date().getFullYear()} RecruitAI. All rights reserved. If you received this email by mistake, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Templates ─────────────────────────────────────────────────────
const templates = {
  schedulingInvite: (candidateName, jobTitle, token) => ({
    subject: `Interview Invitation: ${jobTitle} — Action Required`,
    html: emailLayout(`
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#18181b;line-height:1.3;">
                You've been shortlisted
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                Hi ${candidateName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                Thank you for your application. We're pleased to inform you that after reviewing your profile, you have been selected to proceed to the interview stage for the following position:
              </p>

              <!-- Details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:6px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e4e4e7;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Position</span><br>
                    <span style="font-size:15px;color:#18181b;font-weight:500;">${jobTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Status</span><br>
                    <span style="font-size:15px;color:#16a34a;font-weight:500;">Shortlisted — Interview Pending</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:15px;color:#3f3f46;">
                Please use the link below to select an interview slot that works for you. We recommend scheduling at your earliest convenience as slots are limited.
              </p>

              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:6px;background-color:#4f46e5;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/schedule/${token}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
                      Schedule Interview
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;color:#a1a1aa;line-height:1.5;">
                If the button doesn't work, copy and paste this URL into your browser:<br>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/schedule/${token}" style="color:#4f46e5;word-break:break-all;">${process.env.FRONTEND_URL || 'http://localhost:5173'}/schedule/${token}</a>
              </p>
        `)
  }),

  confirmation: (candidateName, jobTitle, dateTime) => ({
    subject: `Interview Confirmed: ${jobTitle}`,
    html: emailLayout(`
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#18181b;line-height:1.3;">
                Your interview is confirmed
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                Hi ${candidateName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                Your interview has been successfully scheduled. Please find the details below and make sure to join on time.
              </p>

              <!-- Details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #bbf7d0;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Position</span><br>
                    <span style="font-size:15px;color:#18181b;font-weight:500;">${jobTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #bbf7d0;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Date &amp; Time</span><br>
                    <span style="font-size:15px;color:#18181b;font-weight:600;">${dateTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Status</span><br>
                    <span style="font-size:15px;color:#16a34a;font-weight:500;">Confirmed</span>
                  </td>
                </tr>
              </table>

              <!-- Preparation -->
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#18181b;">
                How to prepare:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="padding:4px 0;font-size:14px;color:#3f3f46;">1. Review the job description and required skills.</td></tr>
                <tr><td style="padding:4px 0;font-size:14px;color:#3f3f46;">2. Be ready to discuss your relevant experience.</td></tr>
                <tr><td style="padding:4px 0;font-size:14px;color:#3f3f46;">3. Test your setup if the interview is virtual.</td></tr>
                <tr><td style="padding:4px 0;font-size:14px;color:#3f3f46;">4. Prepare questions you'd like to ask the team.</td></tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;color:#71717a;line-height:1.5;border-top:1px solid #e4e4e7;padding-top:16px;">
                Need to reschedule? Please reach out at least 24 hours before the interview time.
              </p>
        `)
  }),

  reminder: (candidateName, jobTitle, dateTime) => ({
    subject: `Reminder: Interview for ${jobTitle} — ${dateTime}`,
    html: emailLayout(`
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#18181b;line-height:1.3;">
                Interview reminder
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                Hi ${candidateName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                This is a reminder that your upcoming interview is approaching. Please review the details below.
              </p>

              <!-- Details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background-color:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #fde68a;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Position</span><br>
                    <span style="font-size:15px;color:#18181b;font-weight:500;">${jobTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #fde68a;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Scheduled For</span><br>
                    <span style="font-size:15px;color:#18181b;font-weight:600;">${dateTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Status</span><br>
                    <span style="font-size:15px;color:#d97706;font-weight:500;">Upcoming</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#18181b;">Quick checklist:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="padding:3px 0;font-size:14px;color:#3f3f46;">&bull; Join 5 minutes before the scheduled time</td></tr>
                <tr><td style="padding:3px 0;font-size:14px;color:#3f3f46;">&bull; Keep your resume accessible</td></tr>
                <tr><td style="padding:3px 0;font-size:14px;color:#3f3f46;">&bull; Ensure a quiet environment with stable internet</td></tr>
              </table>

              <p style="margin:20px 0 0;font-size:14px;color:#3f3f46;">
                We look forward to speaking with you. Best of luck!
              </p>
        `)
  })
};

module.exports = { sendEmail, templates };
