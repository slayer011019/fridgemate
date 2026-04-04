import { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIngredients } from '../hooks/useIngredients';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { isBackendEnabled } from '../utils/backendConfig';

const TOAST_STYLES = {
  info: 'border-brand-200 bg-white/95 text-slate-700',
  warning: 'border-amber-200 bg-amber-50/95 text-amber-900',
  danger: 'border-rose-200 bg-rose-50/95 text-rose-900'
};

function ConnectionStatusToast() {
  const backendEnabled = isBackendEnabled();
  const { isAuthenticated } = useAuth();
  const { dataSource, error, isSyncing } = useIngredients();
  const { isOnline } = useNetworkStatus();

  const notices = useMemo(() => {
    if (!backendEnabled || !isAuthenticated) {
      return [];
    }

    const nextNotices = [];

    if (!isOnline) {
      nextNotices.push({
        id: 'offline',
        tone: 'danger',
        title: '오프라인 상태',
        description: 'API에 연결할 수 없어 잠시 로컬 인증 캐시를 사용하고 있어요.'
      });
    } else if (dataSource === 'indexeddb') {
      nextNotices.push({
        id: 'fallback',
        tone: 'warning',
        title: '로컬 캐시 사용 중',
        description: error || '서버 응답이 불안정해서 인증된 IndexedDB 캐시로 전환했어요.'
      });
    } else if (error) {
      nextNotices.push({
        id: 'api-error',
        tone: 'danger',
        title: '서버 요청 실패',
        description: error
      });
    }

    if (isOnline && dataSource === 'api' && isSyncing) {
      nextNotices.push({
        id: 'syncing',
        tone: 'info',
        title: '동기화 중',
        description: '최근 변경 사항을 로컬 인증 캐시에 함께 반영하고 있어요.'
      });
    }

    return nextNotices;
  }, [backendEnabled, dataSource, error, isAuthenticated, isOnline, isSyncing]);

  if (!notices.length) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-50 flex w-full max-w-sm flex-col gap-2.5">
      {notices.map((notice) => (
        <section
          key={notice.id}
          className={`pointer-events-auto rounded-[18px] border px-4 py-3 shadow-lg backdrop-blur ${TOAST_STYLES[notice.tone]}`}
        >
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-1 text-sm leading-6">{notice.description}</p>
        </section>
      ))}
    </div>
  );
}

export default ConnectionStatusToast;
