const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function whenLabel(trainingDate, trainingEndDate) {
    return trainingEndDate && trainingEndDate !== trainingDate
        ? `from ${trainingDate} to ${trainingEndDate}`
        : `on ${trainingDate}`;
}

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
