const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const titleEl = document.getElementById('title');
const messageEl = document.getElementById('message');
const actionButtons = document.getElementById('action-buttons');
const declineSection = document.getElementById('decline-section');

if (!token) {
  titleEl.textContent = 'Invalid Link';
  titleEl.className = 'error';
  messageEl.textContent = 'This link is missing a security token. Please check your email and try clicking the link again.';
  actionButtons.style.display = 'none';
}

// Make these available globally for the HTML onclick handlers
window.showDeclineForm = function () {
  declineSection.style.display = 'block';
  actionButtons.style.display = 'none';
}

window.submitResponse = async function (action) {
  let reason = '';
  if (action === 'decline') {
    reason = document.getElementById('reason').value.trim();
    if (!reason) {
      alert('Please provide a reason for declining.');
      return;
    }
  }

  const buttons = document.querySelectorAll('button');
  buttons.forEach(b => b.disabled = true);
  titleEl.textContent = 'Saving...';
  titleEl.className = '';

  try {
    const response = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, reason })
    });

    const data = await response.json();

    if (response.ok) {
      actionButtons.style.display = 'none';
      declineSection.style.display = 'none';
      titleEl.textContent = 'Response Recorded!';
      titleEl.className = 'success';
      messageEl.textContent = action === 'accept'
        ? 'Thank you! Your acceptance has been recorded in the HR system.'
        : 'Your decline reason has been forwarded to the HR department.';
    } else {
      titleEl.textContent = 'Error';
      titleEl.className = 'error';
      messageEl.textContent = data.error || 'An error occurred while saving your response.';
      buttons.forEach(b => b.disabled = false);
    }
  } catch (error) {
    titleEl.textContent = 'Network Error';
    titleEl.className = 'error';
    messageEl.textContent = 'Could not connect to the server. Please check your internet connection.';
    buttons.forEach(b => b.disabled = false);
  }
}