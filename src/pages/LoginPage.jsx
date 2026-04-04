import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';

const defaultForm = {
  email: '',
  password: ''
};

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { backendEnabled, isAuthenticated, loading, login } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate replace to="/account" />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/account', { replace: true });
    } catch (nextError) {
      setError(nextError.message || 'Log in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Authentication"
        title="Log in to use your server-backed workspace"
        description="Guest mode still works without an account. Logging in switches the app to user-scoped persistence."
      />

      {!backendEnabled ? (
        <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-900">
          Authentication is unavailable while the app is running in local-only mode.
        </div>
      ) : null}

      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      <form className="card grid gap-4 md:max-w-lg" onSubmit={handleSubmit}>
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Email
          <input required name="email" type="email" value={form.email} onChange={handleChange} />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Password
          <input required name="password" type="password" value={form.password} onChange={handleChange} />
        </label>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={!backendEnabled || loading || submitting} type="submit">
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
          <Link className="btn-secondary" to="/signup">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
