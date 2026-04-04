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
        title: 'Offline mode',
        description: 'The API is unavailable right now, so FridgeMate is temporarily using the authenticated local cache.'
      });
    } else if (dataSource === 'indexeddb') {
      nextNotices.push({
        id: 'fallback',
        tone: 'warning',
        title: 'Using local fallback',
        description: error || 'The server response was unstable, so the app switched to the authenticated IndexedDB cache.'
      });
    } else if (error) {
      nextNotices.push({
        id: 'api-error',
        tone: 'danger',
        title: 'Server request failed',
        description: error
      });
    }

    if (isOnline && dataSource === 'api' && isSyncing) {
      nextNotices.push({
        id: 'syncing',
        tone: 'info',
        title: 'Syncing changes',
        description: 'Recent updates are being mirrored to the local authenticated cache.'
      });
    }

    return nextNotices;
  }, [backendEnabled, dataSource, error, isAuthenticated, isOnline, isSyncing]);

  if (!notices.length) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-50 flex w-full max-w-sm flex-col gap-3">
      {notices.map((notice) => (
        <section
          key={notice.id}
          className={`pointer-events-auto rounded-[22px] border px-4 py-3 shadow-lg backdrop-blur ${TOAST_STYLES[notice.tone]}`}
        >
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-1 text-sm leading-6">{notice.description}</p>
        </section>
      ))}
    </div>
  );
}

export default ConnectionStatusToast;
