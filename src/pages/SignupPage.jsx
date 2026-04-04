import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';

const defaultForm = {
  email: '',
  password: ''
};

function SignupPage() {
  const navigate = useNavigate();
  const { backendEnabled, isAuthenticated, loading, signup } = useAuth();
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
      await signup(form);
      navigate('/account', { replace: true });
    } catch (nextError) {
      setError(nextError.message || 'Sign up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Authentication"
        title="Create an account for user-scoped persistence"
        description="This keeps guest mode available while adding a clean path for login and future sync improvements."
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
          <input required minLength={8} name="password" type="password" value={form.password} onChange={handleChange} />
        </label>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={!backendEnabled || loading || submitting} type="submit">
            {submitting ? 'Creating account...' : 'Sign up'}
          </button>
          <Link className="btn-secondary" to="/login">
            Already have an account?
          </Link>
        </div>
      </form>
    </div>
  );
}

export default SignupPage;
