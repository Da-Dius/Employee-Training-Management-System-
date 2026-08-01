import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [loading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading || user) return null;

  return (
    <div className="flex min-h-screen items-center bg-slate-50">
      <div className="mx-auto w-full max-w-[420px] px-4">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <GraduationCap className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h4 className="text-lg font-semibold text-slate-900">HRCD Training Management</h4>
          <div className="text-sm text-slate-500">HR staff sign in</div>
        </div>
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  autoFocus
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
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Sign In
              </button>
            </form>
            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div>
        </div>
        <div className="mt-4 text-center">
          <Link to="/signup" className="text-sm text-blue-600 hover:underline">
            Have an invite code? Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}