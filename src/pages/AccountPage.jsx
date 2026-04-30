import PageHeader from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useIngredients } from '../hooks/useIngredients';

function AccountPage() {
  const { dismissGuestImport, error, guestImportPrompt, importGuestIngredients, logout, user } = useAuth();
  const {
    hasUnsyncedChanges,
    lastSyncedAt,
    loadIngredients,
    markIngredientsDirty,
    syncError,
    syncIngredientsToServer,
    syncStatus
  } = useIngredients();

  const handleImportGuestIngredients = async () => {
    await importGuestIngredients();
    markIngredientsDirty();
    await loadIngredients({ force: true });
  };

  const handleSyncIngredients = async () => {
    await syncIngredientsToServer();
  };

  const formattedLastSyncedAt = lastSyncedAt
    ? new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(lastSyncedAt))
    : '아직 동기화하지 않았습니다.';

  const syncButtonText =
    syncStatus === 'syncing'
      ? '동기화 중...'
      : syncStatus === 'error'
        ? '다시 동기화'
        : hasUnsyncedChanges
          ? '변경사항 서버에 저장'
          : syncStatus === 'synced'
            ? '동기화 완료'
            : '서버와 동기화';

  return (
    <div className="section-shell">
      <PageHeader
        eyebrow={'\uACC4\uC815'}
        title={'\uACC4\uC815\uACFC \uC800\uC7A5 \uC0C1\uD0DC\uB97C \uD55C\uB208\uC5D0 \uD655\uC778\uD558\uC138\uC694'}
        description={
          '\uD604\uC7AC \uB85C\uADF8\uC778 \uACC4\uC815\uACFC \uAC8C\uC2A4\uD2B8 \uB370\uC774\uD130 \uAC00\uC838\uC624\uAE30 \uC5EC\uBD80\uB97C \uC5EC\uAE30\uC11C \uAD00\uB9AC\uD569\uB2C8\uB2E4.'
        }
      />

      <section className="card space-y-4">
        {error ? <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div> : null}

        <div className="soft-panel">
          <p className="kicker">{'\uB85C\uADF8\uC778 \uC815\uBCF4'}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{user?.email}</h3>
          <p className="mt-2 text-sm leading-6 muted">{'\uD604\uC7AC \uB85C\uADF8\uC778\uD55C \uACC4\uC815\uC785\uB2C8\uB2E4.'}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={logout} type="button">
            {'\uB85C\uADF8\uC544\uC6C3'}
          </button>
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <p className="kicker">재료 동기화</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">로컬 저장 후 원하는 때 서버에 저장합니다</h3>
          <p className="mt-2 text-sm leading-6 muted">
            재료는 먼저 이 기기에 저장됩니다. 로그인 후 동기화 버튼을 누르면 현재 재료 목록이 서버에 저장되어 다른
            기기에서도 사용할 수 있습니다.
          </p>
          <p className="mt-2 text-sm leading-6 muted">
            재료를 삭제해도 서버에는 즉시 반영되지 않습니다. 삭제 내용을 다른 기기에도 반영하려면 서버와 동기화를
            눌러주세요.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="soft-panel">
            <p className="kicker">현재 로그인 상태</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{user?.email || '로그인이 필요합니다.'}</p>
          </div>
          <div className="soft-panel">
            <p className="kicker">현재 저장 방식</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">로컬 저장 / 서버 동기화 가능</p>
          </div>
          <div className="soft-panel">
            <p className="kicker">마지막 동기화</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formattedLastSyncedAt}</p>
          </div>
          <div className="soft-panel">
            <p className="kicker">동기화되지 않은 변경사항</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {hasUnsyncedChanges ? '있습니다' : '없습니다'}
            </p>
          </div>
        </div>

        {syncStatus === 'synced' ? (
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            현재 로컬 재료 목록을 서버에 저장했습니다.
          </div>
        ) : null}

        {syncError ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{syncError}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn-primary"
            disabled={!user || syncStatus === 'syncing'}
            onClick={handleSyncIngredients}
            type="button"
          >
            {user ? syncButtonText : '로그인 후 동기화 가능'}
          </button>
          <p className="text-xs leading-5 muted">
            MVP 동기화는 현재 기기의 재료 목록으로 서버 목록을 대체하는 last-write-wins 방식입니다.
          </p>
        </div>
      </section>

      {guestImportPrompt.available ? (
        <section className="card space-y-4 border border-brand-200 bg-brand-50/40">
          <div>
            <p className="kicker">{'\uAC8C\uC2A4\uD2B8 \uC7AC\uB8CC \uAC00\uC838\uC624\uAE30'}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{'\uAC8C\uC2A4\uD2B8 \uBAA8\uB4DC \uC7AC\uB8CC\uB97C \uB0B4 \uACC4\uC815\uC73C\uB85C \uAC00\uC838\uC62C\uAE4C\uC694?'}</h3>
            <p className="mt-2 text-sm leading-6 muted">
              {`\uAC8C\uC2A4\uD2B8 \uBAA8\uB4DC\uC5D0\uC11C ${guestImportPrompt.count}\uAC1C\uC758 \uC7AC\uB8CC\uB97C \uCC3E\uC558\uC5B4\uC694. \uD55C \uBC88\uB9CC \uAC00\uC838\uC624\uAC70\uB098, \uC9C0\uAE08\uCC98\uB7FC \uBD84\uB9AC\uD574\uC11C \uC720\uC9C0\uD560 \uC218 \uC788\uC5B4\uC694.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              disabled={guestImportPrompt.loading}
              onClick={handleImportGuestIngredients}
              type="button"
            >
              {guestImportPrompt.loading ? '\uAC00\uC838\uC624\uB294 \uC911...' : '\uAC8C\uC2A4\uD2B8 \uC7AC\uB8CC \uAC00\uC838\uC624\uAE30'}
            </button>
            <button className="btn-secondary" disabled={guestImportPrompt.loading} onClick={dismissGuestImport} type="button">
              {'\uAC8C\uC2A4\uD2B8 \uB370\uC774\uD130\uB294 \uADF8\uB300\uB85C \uB458\uB798\uC694'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AccountPage;
