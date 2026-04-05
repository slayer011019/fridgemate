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
        eyebrow={'\uACC4\uC815'}
        title={'\uAC1C\uC778 \uC800\uC7A5\uC18C \uC0C1\uD0DC\uB97C \uD655\uC778\uD574\uBCF4\uC138\uC694'}
        description={
          '\uAC8C\uC2A4\uD2B8 \uB370\uC774\uD130\uC640 \uACC4\uC815 \uAE30\uBC18 \uB370\uC774\uD130\uB97C \uBD84\uB9AC\uD574 \uAD00\uB9AC\uD558\uACE0 \uC788\uC5B4, \uD604\uC7AC \uAD6C\uC870\uB97C \uC124\uBA85\uD558\uAE30 \uC27D\uACE0 \uC774\uD6C4 \uD655\uC7A5\uB3C4 \uC548\uC804\uD558\uAC8C \uC774\uC5B4\uAC08 \uC218 \uC788\uC5B4\uC694.'
        }
      />

      <section className="card space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="soft-panel">
            <p className="kicker">{'\uB85C\uADF8\uC778 \uC815\uBCF4'}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{user?.email}</h3>
            <p className="mt-2 text-sm leading-6 muted">{'\uD604\uC7AC \uB85C\uADF8\uC778\uD55C \uACC4\uC815\uC785\uB2C8\uB2E4.'}</p>
          </div>

          <div className="soft-panel">
            <p className="kicker">{'\uD604\uC7AC \uC800\uC7A5 \uBC94\uC704'}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{storageScope}</h3>
            <p className="mt-2 text-sm leading-6 muted">{'\uC774 \uBC94\uC704\uC5D0 \uB9DE\uCDB0 \uC7AC\uB8CC \uB370\uC774\uD130\uB97C \uC77D\uACE0 \uC800\uC7A5\uD558\uACE0 \uC788\uC5B4\uC694.'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={logout} type="button">
            {'\uB85C\uADF8\uC544\uC6C3'}
          </button>
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
