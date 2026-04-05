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
      setError(nextError.message || '\uD68C\uC6D0\uAC00\uC785\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={'\uACC4\uC815'}
        title={'\uACC4\uC815\uC744 \uB9CC\uB4E4\uACE0 \uC0AC\uC6A9\uC790 \uC804\uC6A9 \uC800\uC7A5\uC18C\uB97C \uC2DC\uC791\uD574\uBCF4\uC138\uC694'}
        description={
          '\uAC8C\uC2A4\uD2B8 \uBAA8\uB4DC\uB294 \uADF8\uB300\uB85C \uB450\uACE0, \uB85C\uADF8\uC778 \uC774\uD6C4 \uD655\uC7A5\uB41C \uAE30\uB2A5\uC744 \uC704\uD55C \uAE54\uB054\uD55C \uD655\uC7A5 \uACBD\uB85C\uB97C \uB9C8\uB828\uD55C \uAD6C\uC870\uC785\uB2C8\uB2E4.'
        }
      />

      {!backendEnabled ? (
        <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-900">
          {'\uD604\uC7AC\uB294 \uB85C\uCEEC \uC804\uC6A9 \uBAA8\uB4DC\uC5EC\uC11C \uD68C\uC6D0\uAC00\uC785 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC5B4\uC694.'}
        </div>
      ) : null}

      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      <form className="card max-w-xl space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            {'\uC774\uBA54\uC77C'}
            <input required name="email" type="email" value={form.email} onChange={handleChange} />
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            {'\uBE44\uBC00\uBC88\uD638'}
            <input required minLength={8} name="password" type="password" value={form.password} onChange={handleChange} />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/70 pt-1">
          <button className="btn-primary" disabled={!backendEnabled || loading || submitting} type="submit">
            {submitting ? '\uACC4\uC815 \uB9CC\uB4DC\uB294 \uC911...' : '\uD68C\uC6D0\uAC00\uC785'}
          </button>
          <Link className="btn-secondary" to="/login">
            {'\uC774\uBBF8 \uACC4\uC815\uC774 \uC788\uC5B4\uC694'}
          </Link>
        </div>
      </form>
    </div>
  );
}

export default SignupPage;
