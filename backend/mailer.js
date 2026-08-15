const nodemailer = require('nodemailer');

// Gmail SMTP via an App Password — nodemailer's 'gmail' service preset handles the
// host/port/TLS details. If this ever moves to a real transactional provider (Resend,
// Brevo, etc.) later, only this file changes — every caller just imports
// sendConfirmationEmail() and doesn't know or care how delivery actually happens.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

async function sendConfirmationEmail({ to, nomineeName, trainingName, trainingDate, confirmUrl }) {
    await transporter.sendMail({
        from: `"HRCD Training Management" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Please confirm your attendance: ${trainingName}`,
        text:
            `Hi ${nomineeName},\n\n` +
            `Please confirm your attendance for "${trainingName}" on ${trainingDate} using the link below:\n` +
            `${confirmUrl}\n\n` +
            `Thank you.`,
        html:
            `<p>Hi ${nomineeName},</p>` +
            `<p>Please confirm your attendance for <strong>${trainingName}</strong> on ${trainingDate} using the link below:</p>` +
            `<p><a href="${confirmUrl}">${confirmUrl}</a></p>` +
            `<p>Thank you.</p>`,
    });
}

module.exports = { sendConfirmationEmail };