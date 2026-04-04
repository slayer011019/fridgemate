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
      setError(nextError.message || '로그인에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="인증"
        title="계정에 로그인하고 서버 연동 작업 공간을 사용하세요"
        description="게스트 모드는 그대로 유지되며, 로그인하면 사용자별 저장소와 계정 기반 데이터 흐름으로 전환됩니다."
      />

      {!backendEnabled ? (
        <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-900">
          현재는 로컬 전용 모드라서 로그인 기능을 사용할 수 없어요.
        </div>
      ) : null}

      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      <form className="card max-w-xl space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            이메일
            <input required name="email" type="email" value={form.email} onChange={handleChange} />
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            비밀번호
            <input required name="password" type="password" value={form.password} onChange={handleChange} />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/70 pt-1">
          <button className="btn-primary" disabled={!backendEnabled || loading || submitting} type="submit">
            {submitting ? '로그인 중...' : '로그인'}
          </button>
          <Link className="btn-secondary" to="/signup">
            회원가입
          </Link>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;
