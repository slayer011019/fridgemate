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
        title: '\uC624\uD504\uB77C\uC778 \uC0C1\uD0DC',
        description:
          'API\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC5B4 \uC7A0\uC2DC \uB85C\uCEEC \uC778\uC99D \uCE90\uC2DC\uB97C \uC0AC\uC6A9\uD558\uACE0 \uC788\uC5B4\uC694.'
      });
    } else if (dataSource === 'indexeddb') {
      nextNotices.push({
        id: 'fallback',
        tone: 'warning',
        title: '\uB85C\uCEEC \uCE90\uC2DC \uC0AC\uC6A9 \uC911',
        description:
          error ||
          '\uC11C\uBC84 \uC751\uB2F5\uC774 \uBD88\uC548\uC815\uD574\uC11C \uC778\uC99D \uC804\uC6A9 IndexedDB \uCE90\uC2DC\uB85C \uC804\uD658\uB410\uC5B4\uC694.'
      });
    } else if (error) {
      nextNotices.push({
        id: 'api-error',
        tone: 'danger',
        title: '\uC11C\uBC84 \uC694\uCCAD \uC2E4\uD328',
        description: error
      });
    }

    if (isOnline && dataSource === 'api' && isSyncing) {
      nextNotices.push({
        id: 'syncing',
        tone: 'info',
        title: '\uB3D9\uAE30\uD654 \uC911',
        description:
          '\uCD5C\uADFC \uBCC0\uACBD \uC0AC\uD56D\uC744 \uB85C\uCEEC \uC778\uC99D \uCE90\uC2DC\uC5D0\uB3C4 \uD568\uAED8 \uBC18\uC601\uD558\uACE0 \uC788\uC5B4\uC694.'
      });
    }

    return nextNotices;
  }, [backendEnabled, dataSource, error, isAuthenticated, isOnline, isSyncing]);

  if (!notices.length) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-20 z-50 flex max-w-sm flex-col gap-2.5 sm:left-auto sm:right-4 sm:w-full"
    >
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
