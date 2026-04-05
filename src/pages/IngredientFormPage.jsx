import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useIngredients } from '../hooks/useIngredients';
import { defaultIngredientForm, ingredientCategories, storageTypes } from '../utils/ingredientOptions';

function IngredientFormPage() {
  const navigate = useNavigate();
  const { ingredientId } = useParams();
  const { addIngredient, clearError, error, findIngredient, updateIngredient } = useIngredients();
  const [form, setForm] = useState(defaultIngredientForm);
  const [loading, setLoading] = useState(Boolean(ingredientId));
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEditMode = Boolean(ingredientId);

  useEffect(() => {
    if (!ingredientId) {
      return;
    }

    const loadIngredient = async () => {
      try {
        const ingredient = await findIngredient(ingredientId);

        if (ingredient) {
          setForm(ingredient);
        }
      } finally {
        setLoading(false);
      }
    };

    loadIngredient();
  }, [findIngredient, ingredientId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (submitError) {
      setSubmitError('');
    }

    if (error) {
      clearError();
    }

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      if (isEditMode) {
        await updateIngredient(form);
      } else {
        await addIngredient(form);
      }

      navigate('/ingredients');
    } catch (nextError) {
      setSubmitError(nextError instanceof Error ? nextError.message : '\uC7AC\uB8CC\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isEditMode ? '\uC7AC\uB8CC \uC218\uC815' : '\uC7AC\uB8CC \uCD94\uAC00'}
        title={isEditMode ? '\uC7AC\uB8CC \uC815\uBCF4\uB97C \uCC28\uBD84\uD788 \uB2E4\uC2DC \uB2E4\uB4EC\uC5B4\uBCFC\uAE4C\uC694?' : '\uC0C8 \uC7AC\uB8CC\uB97C \uAE54\uB054\uD558\uAC8C \uB4F1\uB85D\uD574\uBCF4\uC138\uC694'}
        description={
          '\uC774\uB984, \uCE74\uD14C\uACE0\uB9AC, \uBCF4\uAD00 \uBC29\uC2DD, \uC218\uB7C9, \uB0A0\uC9DC, \uBA54\uBAA8\uB9CC \uC785\uB825\uD558\uBA74 \uD558\uB098\uC758 \uC7AC\uB8CC \uCE74\uB4DC\uAC00 \uB9CC\uB4E4\uC5B4\uC9D1\uB2C8\uB2E4.'
        }
        action={
          <Link to="/ingredients" className="btn-secondary">
            {'\uBAA9\uB85D\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30'}
          </Link>
        }
      />

      {submitError || error ? (
        <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{submitError || error}</div>
      ) : null}

      <form className="card space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="soft-panel space-y-4">
            <div>
              <p className="kicker">{'\uAE30\uBCF8 \uC815\uBCF4'}</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{'\uC7AC\uB8CC \uC774\uB984\uACFC \uBD84\uB958\uB97C \uBA3C\uC800 \uC785\uB825\uD574\uC8FC\uC138\uC694'}</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                {'\uC774\uB984'}
                <input name="name" value={form.name} onChange={handleChange} placeholder={'\uC6B0\uC720'} required />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                {'\uC218\uB7C9'}
                <input name="quantity" value={form.quantity} onChange={handleChange} placeholder={'1\uD1B5'} required />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                {'\uCE74\uD14C\uACE0\uB9AC'}
                <select name="category" value={form.category} onChange={handleChange}>
                  {ingredientCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                {'\uBCF4\uAD00 \uBC29\uC2DD'}
                <select name="storageType" value={form.storageType} onChange={handleChange}>
                  {storageTypes.map((storageType) => (
                    <option key={storageType} value={storageType}>
                      {storageType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="soft-panel space-y-4">
            <div>
              <p className="kicker">{'\uB0A0\uC9DC\uC640 \uBA54\uBAA8'}</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{'\uAD6C\uB9E4\uC77C\uACFC \uC720\uD1B5\uAE30\uD55C\uC744 \uD544\uC694\uD55C \uB9CC\uD07C\uB9CC \uAE30\uB85D\uD574\uC8FC\uC138\uC694'}</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                {'\uAD6C\uB9E4\uC77C'}
                <input name="purchaseDate" type="date" value={form.purchaseDate} onChange={handleChange} />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                {'\uC720\uD1B5\uAE30\uD55C'}
                <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} />
              </label>

              <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
                {'\uBA54\uBAA8'}
                <textarea
                  name="memo"
                  rows="4"
                  value={form.memo}
                  onChange={handleChange}
                  placeholder={'\uBCF4\uAD00 \uD301\uC774\uB098 \uC0AC\uC6A9 \uC608\uC815 \uBA54\uBAA8'}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/70 pt-1">
          <button type="submit" className="btn-primary" disabled={loading || submitting}>
            {loading
              ? '\uBD88\uB7EC\uC624\uB294 \uC911...'
              : submitting
                ? '\uC800\uC7A5 \uC911...'
                : isEditMode
                  ? '\uC218\uC815 \uC800\uC7A5'
                  : '\uC7AC\uB8CC \uCD94\uAC00'}
          </button>
          <Link to="/ingredients" className="btn-secondary">
            {'\uCDE8\uC18C'}
          </Link>
        </div>
      </form>
    </div>
  );
}

export default IngredientFormPage;
