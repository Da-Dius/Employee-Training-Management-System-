import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';

export default function SignupPage() {
  const { signup, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', password: '', invite_code: '' });
  const [error, setError] = useState('');
  const [requiresInviteCode, setRequiresInviteCode] = useState(true);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    api
      .getAuthStatus()
      .then(({ requiresInviteCode }) => setRequiresInviteCode(requiresInviteCode))
      .catch(() => setRequiresInviteCode(true))
      .finally(() => setStatusLoaded(true));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading || user) return null;

  return (
    <div className="flex min-h-screen items-center bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-[440px] px-4">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <GraduationCap className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h4 className="text-lg font-semibold text-slate-900">HRCD Training Management</h4>
          <div className="text-sm text-slate-500">Create your HR account</div>
        </div>
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Password</label>
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
              {statusLoaded && !requiresInviteCode ? (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  You're creating the first HR account for this system — no invite code needed.
                </div>
              ) : (
                <div>
                  <label className="form-label">Invite Code</label>
                  <input
                    type="text"
                    className="form-input uppercase"
                    required
                    placeholder="Given to you by an HR admin"
                    value={form.invite_code}
                    onChange={(e) => setForm({ ...form, invite_code: e.target.value })}
                  />
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full">
                Create Account
              </button>
            </form>
            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div>
        </div>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
