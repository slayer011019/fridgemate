import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  ANALYTICS_CONSENT_OPEN_EVENT,
  ANALYTICS_CONSENT_UPDATED_EVENT,
  getAnalyticsConsent,
  setAnalyticsConsent
} from '../utils/analyticsConsent';
import { disableGoogleAnalytics, initializeGoogleAnalytics } from '../utils/googleAnalytics';

function subscribeToConsent(callback) {
  window.addEventListener(ANALYTICS_CONSENT_UPDATED_EVENT, callback);
  return () => window.removeEventListener(ANALYTICS_CONSENT_UPDATED_EVENT, callback);
}

function getConsentSnapshot() {
  return getAnalyticsConsent() || 'unset';
}

function AnalyticsConsentBanner() {
  const choice = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => 'loading');
  const [settingsRequested, setSettingsRequested] = useState(false);
  const isOpen = choice === 'unset' || settingsRequested;

  useEffect(() => {
    if (choice === 'granted') {
      initializeGoogleAnalytics();
    }
  }, [choice]);

  useEffect(() => {
    const handleOpen = () => setSettingsRequested(true);
    window.addEventListener(ANALYTICS_CONSENT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(ANALYTICS_CONSENT_OPEN_EVENT, handleOpen);
  }, []);

  const saveChoice = (value) => {
    setAnalyticsConsent(value);
    setSettingsRequested(false);

    if (value === 'granted') {
      initializeGoogleAnalytics();
    } else {
      disableGoogleAnalytics();
    }
  };

  if (!isOpen) return null;

  return (
    <section
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-description"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-lg border border-slate-300 bg-white p-4 shadow-2xl sm:bottom-5 sm:p-5"
      role="dialog"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="kicker">분석 설정</p>
          <h2 id="analytics-consent-title" className="mt-1 text-lg font-semibold text-slate-950">
            서비스 개선을 위한 이용 분석에 동의하시겠어요?
          </h2>
          <p id="analytics-consent-description" className="mt-2 text-sm leading-6 text-slate-600">
            동의한 경우에만 Google Analytics를 불러옵니다. 이메일과 오늘뭐먹지 내부 사용자 식별자는 전송하지 않으며,
            선택은 언제든 변경할 수 있습니다.{' '}
            <Link className="font-semibold text-brand-700 underline underline-offset-2" to="/privacy">
              개인정보 처리 안내
            </Link>
          </p>
          {choice === 'granted' || choice === 'denied' ? (
            <p className="mt-2 text-xs font-medium text-slate-500">
              현재 설정: {choice === 'granted' ? '이용 분석 허용' : '필수 기능만 사용'}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <button
            className="btn-secondary min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            onClick={() => saveChoice('denied')}
            type="button"
          >
            필수 기능만
          </button>
          <button
            className="btn-primary min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            onClick={() => saveChoice('granted')}
            type="button"
          >
            분석 허용
          </button>
        </div>
      </div>
    </section>
  );
}

export default AnalyticsConsentBanner;
