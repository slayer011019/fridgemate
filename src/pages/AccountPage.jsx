import PageHeader from '../components/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useIngredients } from '../hooks/useIngredients';

function AccountPage() {
  const { dismissGuestImport, guestImportPrompt, importGuestIngredients, logout, storageScope, user } = useAuth();
  const { loadIngredients } = useIngredients();

  const handleImportGuestIngredients = async () => {
    await importGuestIngredients();
    await loadIngredients({ force: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="계정"
        title="내 인증 작업 공간"
        description="게스트 데이터와 계정 기반 데이터는 분리해서 관리하고 있어, 현재 구조를 설명하기 쉽고 이후 확장도 안전하게 이어갈 수 있어요."
      />

      <section className="card space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="soft-panel">
            <p className="kicker">로그인 정보</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{user?.email}</h3>
            <p className="mt-2 text-sm leading-6 muted">현재 로그인된 계정입니다.</p>
          </div>

          <div className="soft-panel">
            <p className="kicker">현재 저장 범위</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{storageScope}</h3>
            <p className="mt-2 text-sm leading-6 muted">이 범위에 맞춰 재료 데이터를 읽고 저장하고 있어요.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={logout} type="button">
            로그아웃
          </button>
        </div>
      </section>

      {guestImportPrompt.available ? (
        <section className="card space-y-4 border border-brand-200 bg-brand-50/40">
          <div>
            <p className="kicker">게스트 재료 가져오기</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">게스트 모드 재료를 이 계정으로 가져올까요?</h3>
            <p className="mt-2 text-sm leading-6 muted">
              {`게스트 모드에서 ${guestImportPrompt.count}개의 재료를 찾았어요. 한 번만 가져오거나, 지금처럼 분리해서 유지할 수 있습니다.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              disabled={guestImportPrompt.loading}
              onClick={handleImportGuestIngredients}
              type="button"
            >
              {guestImportPrompt.loading ? '가져오는 중...' : '게스트 재료 가져오기'}
            </button>
            <button className="btn-secondary" disabled={guestImportPrompt.loading} onClick={dismissGuestImport} type="button">
              게스트 데이터는 그대로 둘래요
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AccountPage;
