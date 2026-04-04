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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Your authenticated workspace"
        description="Guest data and account-backed data stay separate, which keeps the current architecture easy to explain and safer to extend later."
      />

      <section className="card space-y-4">
        <div>
          <p className="kicker">Signed in as</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{user?.email}</h3>
          <p className="mt-2 text-sm leading-6 muted">{`Current ingredient scope: ${storageScope}`}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </section>

      {guestImportPrompt.available ? (
        <section className="card space-y-4 border border-brand-200 bg-brand-50/40">
          <div>
            <p className="kicker">Guest ingredients</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Import your guest ingredients into this account?</h3>
            <p className="mt-2 text-sm leading-6 muted">
              {`Found ${guestImportPrompt.count} ingredient${guestImportPrompt.count === 1 ? '' : 's'} in guest mode. You can import them once or keep guest data separate.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              disabled={guestImportPrompt.loading}
              onClick={handleImportGuestIngredients}
              type="button"
            >
              {guestImportPrompt.loading ? 'Importing...' : 'Import guest ingredients'}
            </button>
            <button className="btn-secondary" disabled={guestImportPrompt.loading} onClick={dismissGuestImport} type="button">
              Keep guest data separate
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AccountPage;
