import { useState } from 'react';
import { useUserPreferences } from '../hooks/useUserPreferences';

function parseIngredients(value) {
  return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))];
}

function PreferenceSettingsPanel() {
  const { error, preferences, savePreferences, saving } = useUserPreferences();
  const [status, setStatus] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('');
    const formData = new FormData(event.currentTarget);
    try {
      await savePreferences({
        ...preferences,
        preferredIngredients: parseIngredients(formData.get('preferredIngredients')),
        dislikedIngredients: parseIngredients(formData.get('dislikedIngredients'))
      });
      setStatus('취향 설정을 저장했습니다.');
    } catch {
      setStatus('');
    }
  };

  return (
    <section className="card space-y-4">
      <div>
        <p className="kicker">추천 취향</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">자주 찾는 재료와 피하고 싶은 재료</h3>
        <p className="mt-2 text-sm leading-6 muted">쉼표로 구분해 입력하면 추천 순서에 가볍게 반영합니다.</p>
      </div>
      <form
        key={`${preferences.preferredIngredients?.join('|')}::${preferences.dislikedIngredients?.join('|')}`}
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-900">
            선호 재료
            <input className="input mt-2 w-full" defaultValue={(preferences.preferredIngredients || []).join(', ')} maxLength={500} name="preferredIngredients" />
          </label>
          <label className="text-sm font-semibold text-slate-900">
            비선호 재료
            <input className="input mt-2 w-full" defaultValue={(preferences.dislikedIngredients || []).join(', ')} maxLength={500} name="dislikedIngredients" />
          </label>
          <label className="text-sm font-semibold text-slate-900">
            매운맛
            <select
              className="input mt-2 w-full"
              onChange={(event) => savePreferences({ ...preferences, spiceLevel: event.target.value }).catch(() => {})}
              value={preferences.spiceLevel}
            >
              <option value="mild">순한맛</option>
              <option value="medium">보통</option>
              <option value="spicy">매운맛</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-900">
            조리 여유
            <select
              className="input mt-2 w-full"
              onChange={(event) => savePreferences({ ...preferences, cookingTimePreference: event.target.value }).catch(() => {})}
              value={preferences.cookingTimePreference}
            >
              <option value="quick">빠르게</option>
              <option value="flexible">상관없음</option>
              <option value="leisurely">여유 있게</option>
            </select>
          </label>
        </div>
        {status ? <p className="text-sm font-medium text-emerald-700">{status}</p> : null}
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        <button className="btn-primary" disabled={saving} type="submit">
          {saving ? '저장 중...' : '취향 저장'}
        </button>
      </form>
    </section>
  );
}

export default PreferenceSettingsPanel;
