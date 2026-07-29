const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, options);

  if (res.status === 401 && url !== `${BASE}/auth/me`) {
    window.location.href = '/login';
    return new Promise(() => {}); // halt: page is navigating away
  }
  if (res.status === 204) return null;

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body;
}

function jsonBody(data) {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export const getMe = () => request(`${BASE}/auth/me`);
export const getAuthStatus = () => request(`${BASE}/auth/status`);
export const login = (username, password) =>
  request(`${BASE}/auth/login`, { method: 'POST', ...jsonBody({ username, password }) });
export const signup = (data) => request(`${BASE}/auth/signup`, { method: 'POST', ...jsonBody(data) });
export const logout = () => request(`${BASE}/auth/logout`, { method: 'POST' });

export const listUsers = () => request(`${BASE}/users`);
export const createUser = (data) => request(`${BASE}/users`, { method: 'POST', ...jsonBody(data) });
export const deleteUser = (id) => request(`${BASE}/users/${id}`, { method: 'DELETE' });
export const resetUserPassword = (id, new_password) =>
  request(`${BASE}/users/${id}/reset-password`, { method: 'POST', ...jsonBody({ new_password }) });
export const getInviteCode = () => request(`${BASE}/users/invite-code`);
export const regenerateInviteCode = () => request(`${BASE}/users/invite-code/regenerate`, { method: 'POST' });

export const getDashboard = () => request(`${BASE}/dashboard`);

export const listTrainings = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return request(`${BASE}/trainings?${qs.toString()}`);
};
export const getTraining = (id) => request(`${BASE}/trainings/${id}`);
export const createTraining = (data) => request(`${BASE}/trainings`, { method: 'POST', ...jsonBody(data) });
export const updateTraining = (id, data) => request(`${BASE}/trainings/${id}`, { method: 'PUT', ...jsonBody(data) });
export const deleteTraining = (id) => request(`${BASE}/trainings/${id}`, { method: 'DELETE' });

export const listNominees = (trainingId) => request(`${BASE}/trainings/${trainingId}/nominees`);
export const createNominee = (trainingId, data) =>
  request(`${BASE}/trainings/${trainingId}/nominees`, { method: 'POST', ...jsonBody(data) });
export const setAttendance = (trainingId, nomineeId, attendance_status) =>
  request(`${BASE}/trainings/${trainingId}/nominees/${nomineeId}/attendance`, {
    method: 'PATCH',
    ...jsonBody({ attendance_status }),
  });
export const deleteNominee = (trainingId, nomineeId) =>
  request(`${BASE}/trainings/${trainingId}/nominees/${nomineeId}`, { method: 'DELETE' });

export const listEvidence = (trainingId) => request(`${BASE}/trainings/${trainingId}/evidence`);
export const uploadEvidence = async (trainingId, files) => {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append('files', f));
  const res = await fetch(`${BASE}/trainings/${trainingId}/evidence`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Upload failed');
  return body;
};
export const deleteEvidence = (trainingId, evidenceId) =>
  request(`${BASE}/trainings/${trainingId}/evidence/${evidenceId}`, { method: 'DELETE' });
export const evidenceDownloadUrl = (trainingId, evidenceId) =>
  `${BASE}/trainings/${trainingId}/evidence/${evidenceId}/download`;

export const getMonthlyReport = (month) => request(`${BASE}/reports/monthly?month=${month || ''}`);
export const monthlyReportExportUrl = (month) => `${BASE}/reports/monthly/export?month=${month || ''}`;
