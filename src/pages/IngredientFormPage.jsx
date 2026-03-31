import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useIngredients } from '../hooks/useIngredients';
import { defaultIngredientForm, ingredientCategories, storageTypes } from '../utils/ingredientOptions';

function IngredientFormPage() {
  const navigate = useNavigate();
  const { ingredientId } = useParams();
  const { addIngredient, findIngredient, updateIngredient } = useIngredients();
  const [form, setForm] = useState(defaultIngredientForm);
  const [loading, setLoading] = useState(Boolean(ingredientId));
  const isEditMode = Boolean(ingredientId);

  useEffect(() => {
    if (!ingredientId) {
      return;
    }

    const loadIngredient = async () => {
      const ingredient = await findIngredient(ingredientId);

      if (ingredient) {
        setForm(ingredient);
      }

      setLoading(false);
    };

    loadIngredient();
  }, [findIngredient, ingredientId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isEditMode) {
      await updateIngredient(form);
    } else {
      await addIngredient(form);
    }

    navigate('/ingredients');
  };

  return (
    <div className="space-y-6">
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

      <form className="card grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'\uC774\uB984'}
          <input name="name" value={form.name} onChange={handleChange} placeholder={'\uC6B0\uC720'} required />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'\uC218\uB7C9'}
          <input name="quantity" value={form.quantity} onChange={handleChange} placeholder={'1\uD1B5'} required />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'\uCE74\uD14C\uACE0\uB9AC'}
          <select name="category" value={form.category} onChange={handleChange}>
            {ingredientCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'\uBCF4\uAD00 \uBC29\uC2DD'}
          <select name="storageType" value={form.storageType} onChange={handleChange}>
            {storageTypes.map((storageType) => (
              <option key={storageType} value={storageType}>
                {storageType}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'\uAD6C\uB9E4\uC77C'}
          <input name="purchaseDate" type="date" value={form.purchaseDate} onChange={handleChange} />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'\uC720\uD1B5\uAE30\uD55C'}
          <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
          {'\uBA54\uBAA8'}
          <textarea
            name="memo"
            rows="4"
            value={form.memo}
            onChange={handleChange}
            placeholder={'\uBCF4\uAD00 \uD301\uC774\uB098 \uC0AC\uC6A9 \uC608\uC815 \uBA54\uBAA8'}
          />
        </label>

        <label className="soft-panel flex items-center gap-3 text-sm font-medium text-slate-700 md:col-span-2">
          <input
            className="h-4 w-4 rounded border-slate-300"
            name="consumed"
            type="checkbox"
            checked={form.consumed}
            onChange={handleChange}
          />
          {'\uC774\uBBF8 \uC18C\uBE44\uD55C \uC7AC\uB8CC\uB85C \uD45C\uC2DC'}
        </label>

        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '\uBD88\uB7EC\uC624\uB294 \uC911...' : isEditMode ? '\uC218\uC815 \uC800\uC7A5' : '\uC7AC\uB8CC \uCD94\uAC00'}
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
