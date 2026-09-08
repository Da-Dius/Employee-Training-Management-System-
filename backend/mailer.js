const nodemailer = require('nodemailer');

// Gmail SMTP via an App Password — nodemailer's 'gmail' service preset handles the
// host/port/TLS details. If this ever moves to a real transactional provider (Resend,
// Brevo, etc.) later, only this file changes — every caller just imports the send
// function it needs and doesn't know or care how delivery actually happens.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// Training and nominee names are HR free text, so they can't go into an HTML body raw —
// a name containing "<" would break the markup. The plain-text bodies need no escaping.
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// One label for both bodies of both emails, so none of them has to branch on whether
// this is a single-day training or a multi-day range.
function whenLabel(trainingDate, trainingEndDate) {
    return trainingEndDate && trainingEndDate !== trainingDate
        ? `from ${trainingDate} to ${trainingEndDate}`
        : `on ${trainingDate}`;
}

// Step 1 — sent when HR nominates someone. Accepting is their commitment to attend;
// declining tells HR to nominate someone in their place.
async function sendNominationEmail({ to, nomineeName, trainingName, trainingDate, trainingEndDate, confirmUrl }) {
    const when = whenLabel(trainingDate, trainingEndDate);

    await transporter.sendMail({
        from: `"HRCD Training Management" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Training nomination — please accept or decline: ${trainingName}`,
        text:
            `Hi ${nomineeName},\n\n` +
            `You have been nominated for "${trainingName}" ${when}.\n` +
            `Please use the link below to accept or decline this nomination:\n` +
            `${confirmUrl}\n\n` +
            `Accepting confirms you will attend. If you decline, HR will nominate someone in your place.\n\n` +
            `Thank you.`,
        html:
            `<p>Hi ${escapeHtml(nomineeName)},</p>` +
            `<p>You have been nominated for <strong>${escapeHtml(trainingName)}</strong> ${escapeHtml(when)}.</p>` +
            `<p><a href="${confirmUrl}">Accept or decline this nomination</a></p>` +
            `<p>Accepting confirms you will attend. If you decline, HR will nominate someone in your place.</p>` +
            `<p>Thank you.</p>`,
    });
}

// Step 2 — HR-triggered once the training has ended. Same token as the nomination link,
// but the page asks a different question by then.
async function sendAttendanceCheckEmail({ to, nomineeName, trainingName, trainingDate, trainingEndDate, confirmUrl }) {
    const when = whenLabel(trainingDate, trainingEndDate);

    await transporter.sendMail({
        from: `"HRCD Training Management" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Did you attend? ${trainingName}`,
        text:
            `Hi ${nomineeName},\n\n` +
            `"${trainingName}" took place ${when} and you had accepted the nomination.\n` +
            `Please confirm whether you actually attended:\n` +
            `${confirmUrl}\n\n` +
            `Thank you.`,
        html:
            `<p>Hi ${escapeHtml(nomineeName)},</p>` +
            `<p><strong>${escapeHtml(trainingName)}</strong> took place ${escapeHtml(when)} and you had accepted the nomination.</p>` +
            `<p><a href="${confirmUrl}">Confirm whether you attended</a></p>` +
            `<p>Thank you.</p>`,
    });
}

module.exports = { sendNominationEmail, sendAttendanceCheckEmail };
