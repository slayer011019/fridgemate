import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import IngredientFilters from '../components/IngredientFilters';
import IngredientList from '../components/IngredientList';
import PageHeader from '../components/PageHeader';
import ShoppingListPanel from '../components/ShoppingListPanel';
import {
  defaultIngredientFilters,
  filterIngredients,
  getConsumedIngredients
} from '../features/ingredients/ingredientSelectors';
import { useAnalytics } from '../hooks/useAnalytics';
import { useIngredients } from '../hooks/useIngredients';
import { getDaysToExpiryBucket } from '../utils/analytics';
import { isOcrEnabled } from '../utils/backendConfig';
import { ingredientCategories, storageTypes } from '../utils/ingredientOptions';

function IngredientsPage() {
  const { ingredients, loading, error, removeIngredient, updateIngredient } = useIngredients();
  const { trackEvent } = useAnalytics();
  const ocrEnabled = isOcrEnabled();
  const [filters, setFilters] = useState(defaultIngredientFilters);

  const filteredIngredients = useMemo(() => filterIngredients(ingredients, filters), [filters, ingredients]);
  const shoppingListItems = useMemo(() => getConsumedIngredients(ingredients), [ingredients]);
  const activeIngredientCount = useMemo(() => ingredients.filter((ingredient) => !ingredient.consumed).length, [ingredients]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  }, []);

  const handleToggleConsumed = useCallback(
    async (ingredient) => {
      try {
        await updateIngredient({
          ...ingredient,
          consumed: !ingredient.consumed
        });

        if (ingredient.consumed) {
          trackEvent('ingredient_restored', {
            days_to_expiry_bucket: getDaysToExpiryBucket(ingredient.expiryDate)
          });
        } else {
          trackEvent('ingredient_consumed', {
            days_to_expiry_bucket: getDaysToExpiryBucket(ingredient.expiryDate),
            source: 'ingredients_list'
          });
        }
      } catch {
        // Error state is surfaced from the hook.
      }
    },
    [trackEvent, updateIngredient]
  );

  const handleDelete = useCallback(
    async (id) => {
      try {
        await removeIngredient(id);
      } catch {
        // Error state is surfaced from the hook.
      }
    },
    [removeIngredient]
  );

  const handleSaveShoppingListDetails = useCallback(
    async (ingredient) => {
      try {
        await updateIngredient(ingredient);
      } catch {
        // Error state is surfaced from the hook.
      }
    },
    [updateIngredient]
  );

  const handleRestoreAllShoppingItems = useCallback(async () => {
    try {
      await Promise.all(
        shoppingListItems.map((ingredient) =>
          updateIngredient({
            ...ingredient,
            consumed: false
          })
        )
      );
    } catch {
      // Error state is surfaced from the hook.
    }
  }, [shoppingListItems, updateIngredient]);

  return (
    <div className="section-shell">
      <PageHeader
        eyebrow={'\uC7AC\uB8CC \uAD00\uB9AC'}
        title={'\uC7AC\uB8CC\uB97C \uBE60\uB974\uAC8C \uCC3E\uACE0, \uC9C0\uAE08 \uC4F0\uC2E4 \uAC83\uBD80\uD130 \uC815\uB9AC\uD558\uC138\uC694'}
        description={
          '\uAC80\uC0C9\uACFC \uD544\uD130\uB85C \uBC94\uC704\uB97C \uC904\uC774\uACE0, \uC720\uD1B5\uAE30\uD55C \uC784\uBC15 \uC21C\uC73C\uB85C \uBCF4\uBA74 \uBB34\uC5C7\uC744 \uBA3C\uC800 \uCC98\uB9AC\uD560\uC9C0 \uBC14\uB85C \uBCF4\uC785\uB2C8\uB2E4.'
        }
        action={
          <>
            {ocrEnabled ? (
              <Link to="/import" className="btn-secondary">
                {'\uC2A4\uD06C\uB9B0\uC0F7 \uBD88\uB7EC\uC624\uAE30'}
              </Link>
            ) : null}
            <Link to="/ingredients/new" className="btn-primary">
              {'\uC7AC\uB8CC \uCD94\uAC00'}
            </Link>
          </>
        }
      />

      <IngredientFilters
        filters={filters}
        categories={ingredientCategories}
        storageTypes={storageTypes}
        onChange={handleFilterChange}
      />

      <section className="glass-card flex flex-col gap-3 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="summary-chip">{`\uBCF4\uC720 \uC911 ${activeIngredientCount}\uAC1C`}</span>
          <span className="summary-chip">{`\uAC80\uC0C9 \uACB0\uACFC ${filteredIngredients.length}\uAC1C`}</span>
          <span className="summary-chip">{`\uC7AC\uAD6C\uB9E4 \uD6C4\uBCF4 ${shoppingListItems.length}\uAC1C`}</span>
        </div>
        <p className="text-xs muted">{'\uD575\uC2EC \uC561\uC158\uC740 \uC18C\uBE44 \uCC98\uB9AC, \uBCF4\uC870 \uC561\uC158\uC740 \uC218\uC815 \uC911\uC2EC\uC73C\uB85C \uBC30\uCE58\uD588\uC5B4\uC694.'}</p>
      </section>

      {!loading ? (
        <ShoppingListPanel
          items={shoppingListItems}
          onDelete={handleDelete}
          onRestore={handleToggleConsumed}
          onRestoreAll={handleRestoreAllShoppingItems}
          onSaveDetails={handleSaveShoppingListDetails}
        />
      ) : null}

      {loading ? <div className="card text-sm muted">{'\uC7AC\uB8CC\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...'}</div> : null}
      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      {!loading && !filteredIngredients.length ? (
        <EmptyState
          title={'\uD604\uC7AC \uC870\uAC74\uC5D0 \uB9DE\uB294 \uC7AC\uB8CC\uAC00 \uC5C6\uC5B4\uC694'}
          description={'\uD544\uD130\uB97C \uBC14\uAFB8\uAC70\uB098 \uC0C8 \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD574\uC11C \uBAA9\uB85D\uC744 \uCC44\uC6CC\uBCF4\uC138\uC694.'}
        />
      ) : null}

      <IngredientList ingredients={filteredIngredients} onDelete={handleDelete} onToggleConsumed={handleToggleConsumed} />
    </div>
  );
}

export default IngredientsPage;
