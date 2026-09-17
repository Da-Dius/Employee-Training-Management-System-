async function confirmAttendance() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const titleEl = document.getElementById('title');
    const messageEl = document.getElementById('message');

    if (!token) {
        titleEl.textContent = 'Invalid Link';
        titleEl.className = 'error';
        messageEl.textContent = 'This link is missing a security token. Please check your email and try clicking the link again.';
        return;
    }

    try {
        const response = await fetch('/api/confirm/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (response.ok) {
            titleEl.textContent = 'Attendance Confirmed!';
            titleEl.className = 'success';
            messageEl.textContent = 'Thank you. Your attendance has been successfully recorded in the HR system. You may now close this window.';
        } else {
            titleEl.textContent = 'Confirmation Failed';
            titleEl.className = 'error';
            messageEl.textContent = data.error || 'An error occurred while confirming your attendance.';
        }
    } catch (error) {
        titleEl.textContent = 'Network Error';
        titleEl.className = 'error';
        messageEl.textContent = 'Could not connect to the server. Please check your internet connection and try again.';
    }
}

confirmAttendance();