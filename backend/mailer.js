const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Reuse SMTP connections instead of opening a new one per email
    pool: true,
    maxConnections: 3,
    // Fail within seconds on a stuck connection, so HR sees "email could not be sent" instead of
    // the request hanging until the browser or load balancer gives up (defaults are minutes).
    connectionTimeout: 10 * 1000,
    greetingTimeout: 10 * 1000,
    socketTimeout: 20 * 1000,
});

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function whenLabel(training_date, training_end_date) {
    return training_end_date && training_end_date !== training_date
        ? `from ${training_date} to ${training_end_date}`
        : `on ${training_date}`;
}

async function sendNominationEmail({ to, nomineeName, trainingName, trainingDate, trainingEndDate, confirmUrl }) {
    const when = whenLabel(trainingDate, trainingEndDate);

    await transporter.sendMail({
        from: `"HRCD Training Management" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Program nomination — please accept or decline: ${trainingName}`,
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

async function sendAttendanceCheckEmail(to, nomineeName, trainingName, confirmUrl) {
    const mailOptions = {
        from: `"HR Training Portal" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: `Attendance Confirmation Required: ${trainingName}`,
        html: `
            <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #111827; margin-top: 0;">Training Check-In</h2>
                <p style="color: #374151; font-size: 16px;">Hello <b>${nomineeName}</b>,</p>
                <p style="color: #374151; font-size: 16px;">
                    Please confirm your attendance for the following training program: <br>
                    <strong>${trainingName}</strong>
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${confirmUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                        ✅ Yes, I Attended
                    </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                    If you did not attend this training, no action is required.
                </p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendNominationEmail, sendAttendanceCheckEmail };