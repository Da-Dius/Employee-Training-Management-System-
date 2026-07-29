import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { formatDate } from '../utils';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';

const emptyForm = { name: '', username: '', password: '' };
const emptyResetForm = { password: '', confirm: '' };

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('------');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [resetForm, setResetForm] = useState(emptyResetForm);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState('');

  const loadUsers = () => {
    api
      .listUsers()
      .then((data) => {
        setUsers(data);
        setError('');
      })
      .catch((e) => setError(e.message));
  };

  const loadInviteCode = () => {
    api
      .getInviteCode()
      .then(({ invite_code }) => setInviteCode(invite_code))
      .catch(() => setInviteCode('error'));
  };

  useEffect(() => {
    loadUsers();
    loadInviteCode();
  }, []);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      showToast('Invite code copied to clipboard');
    } catch {
      window.prompt('Copy this invite code:', inviteCode);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate the invite code? The old code will stop working immediately.')) return;
    try {
      const { invite_code } = await api.regenerateInviteCode();
      setInviteCode(invite_code);
      showToast('Invite code regenerated');
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Remove this HR user account?')) return;
    try {
      await api.deleteUser(userId);
      loadUsers();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.createUser(form);
      showToast('HR user added');
      setModalOpen(false);
      setForm(emptyForm);
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetForm.password !== resetForm.confirm) {
      setResetError('Passwords do not match');
      return;
    }
    setResetSaving(true);
    setResetError('');
    try {
      await api.resetUserPassword(resetTarget.id, resetForm.password);
      showToast(`Password reset for ${resetTarget.name}`);
      setResetTarget(null);
      setResetForm(emptyResetForm);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">HR Users</h1>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <i className="bi bi-person-plus"></i>Add HR User
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <i className="bi bi-ticket-perforated"></i>Self-Service Invite Code
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Share this code with colleagues along with the sign-in page link (<code>/signup</code>) so they can create
            their own HR account instead of you sharing a password.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-lg font-semibold tracking-wide text-slate-800">
              {inviteCode}
            </code>
            <button className="btn btn-outline btn-sm" onClick={handleCopyInvite}>
              <i className="bi bi-clipboard"></i>Copy
            </button>
            <button className="btn btn-outline-danger btn-sm" onClick={handleRegenerate}>
              <i className="bi bi-arrow-repeat"></i>Regenerate
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Added</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!error && users === null && (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <Spinner small />
                  </td>
                </tr>
              )}
              {!error &&
                users &&
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-slate-900">{u.name}</td>
                    <td>{u.username}</td>
                    <td>{formatDate(u.created_at.slice(0, 10))}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn btn-outline btn-icon"
                          title="Reset Password"
                          onClick={() => {
                            setResetTarget(u);
                            setResetForm(emptyResetForm);
                            setResetError('');
                          }}
                        >
                          <i className="bi bi-key"></i>
                        </button>
                        <button className="btn btn-outline-danger btn-icon" title="Remove" onClick={() => handleDelete(u.id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add HR User"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="userForm" className="btn btn-primary" disabled={saving}>
              Add User
            </button>
          </>
        }
      >
        <form id="userForm" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Username *</label>
            <input
              type="text"
              className="form-input"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-input"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <div className="form-hint">At least 8 characters.</div>
          </div>
          {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
        </form>
      </Modal>

      <Modal
        show={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={resetTarget ? `Reset Password for ${resetTarget.name}` : 'Reset Password'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setResetTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="resetForm" className="btn btn-primary" disabled={resetSaving}>
              Reset Password
            </button>
          </>
        }
      >
        <form id="resetForm" onSubmit={handleResetSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">
            This immediately replaces their current password. Share the new one with them directly.
          </p>
          <div>
            <label className="form-label">New Password *</label>
            <input
              type="password"
              className="form-input"
              required
              minLength={8}
              value={resetForm.password}
              onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
            />
            <div className="form-hint">At least 8 characters.</div>
          </div>
          <div>
            <label className="form-label">Confirm Password *</label>
            <input
              type="password"
              className="form-input"
              required
              minLength={8}
              value={resetForm.confirm}
              onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })}
            />
          </div>
          {resetError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{resetError}</div>}
        </form>
      </Modal>
    </>
  );
}
