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
      setError(nextError.message || '회원가입에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="인증"
        title="계정을 만들고 사용자별 저장소를 시작하세요"
        description="게스트 모드는 그대로 두고, 로그인과 향후 동기화 기능을 위한 깔끔한 확장 경로를 마련한 구조입니다."
      />

      {!backendEnabled ? (
        <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-900">
          현재는 로컬 전용 모드라서 회원가입 기능을 사용할 수 없어요.
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
            <input required minLength={8} name="password" type="password" value={form.password} onChange={handleChange} />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/70 pt-1">
          <button className="btn-primary" disabled={!backendEnabled || loading || submitting} type="submit">
            {submitting ? '계정 만드는 중...' : '회원가입'}
          </button>
          <Link className="btn-secondary" to="/login">
            이미 계정이 있어요
          </Link>
        </div>
      </form>
    </div>
  );
}

export default SignupPage;
