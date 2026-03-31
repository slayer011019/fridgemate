import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import IngredientFilters from '../components/IngredientFilters';
import IngredientList from '../components/IngredientList';
import PageHeader from '../components/PageHeader';
import ShoppingListPanel from '../components/ShoppingListPanel';
import { useIngredients } from '../hooks/useIngredients';
import { getRemainingDays } from '../utils/date';
import { ingredientCategories, storageTypes } from '../utils/ingredientOptions';

function IngredientsPage() {
  const { ingredients, loading, removeIngredient, updateIngredient } = useIngredients();
  const [filters, setFilters] = useState({
    category: 'all',
    storageType: 'all',
    sortOrder: 'asc',
    status: 'all'
  });

  const filteredIngredients = useMemo(() => {
    const items = ingredients.filter((ingredient) => {
      const matchesCategory = filters.category === 'all' || ingredient.category === filters.category;
      const matchesStorage = filters.storageType === 'all' || ingredient.storageType === filters.storageType;
      const matchesStatus =
        filters.status === 'all' ||
        (filters.status === 'active' && !ingredient.consumed) ||
        (filters.status === 'consumed' && ingredient.consumed);

      return matchesCategory && matchesStorage && matchesStatus;
    });

    items.sort((a, b) => {
      const left = getRemainingDays(a.expiryDate);
      const right = getRemainingDays(b.expiryDate);
      const leftValue = left === null ? Number.MAX_SAFE_INTEGER : left;
      const rightValue = right === null ? Number.MAX_SAFE_INTEGER : right;

      return filters.sortOrder === 'asc' ? leftValue - rightValue : rightValue - leftValue;
    });

    return items;
  }, [filters, ingredients]);

  const shoppingListItems = useMemo(
    () => ingredients.filter((ingredient) => ingredient.consumed),
    [ingredients]
  );

  const handleFilterChange = useCallback((field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  }, []);

  const handleToggleConsumed = useCallback(async (ingredient) => {
    await updateIngredient({
      ...ingredient,
      consumed: !ingredient.consumed
    });
  }, [updateIngredient]);

  const handleDelete = useCallback(async (id) => {
    await removeIngredient(id);
  }, [removeIngredient]);

  const handleSaveShoppingListDetails = useCallback(async (ingredient) => {
    await updateIngredient(ingredient);
  }, [updateIngredient]);

  const handleRestoreAllShoppingItems = useCallback(async () => {
    await Promise.all(
      shoppingListItems.map((ingredient) =>
        updateIngredient({
          ...ingredient,
          consumed: false
        })
      )
    );
  }, [shoppingListItems, updateIngredient]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={'\uC7AC\uB8CC \uAD00\uB9AC'}
        title={'\uBCF4\uC720 \uC911\uC778 \uC7AC\uB8CC\uB97C \uC27D\uACE0 \uC815\uB3C8\uB418\uAC8C \uC0B4\uD3B4\uBCF4\uC138\uC694'}
        description={
          '\uB0C9\uC7A5, \uB0C9\uB3D9, \uD32C\uD2B8\uB9AC\uB85C \uB098\uB220 \uBCF4\uACE0 \uC720\uD1B5\uAE30\uD55C \uC21C\uC73C\uB85C \uC815\uB82C\uD558\uBA74 \uBB34\uC5C7\uC744 \uBA3C\uC800 \uC368\uC57C \uD560\uC9C0 \uBC14\uB85C \uD30C\uC545\uD560 \uC218 \uC788\uC5B4\uC694.'
        }
        action={
          <>
            <Link to="/import" className="btn-secondary">
              {'\uC2A4\uD06C\uB9B0\uC0F7 \uBD88\uB7EC\uC624\uAE30'}
            </Link>
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

      {!loading ? (
        <ShoppingListPanel
          items={shoppingListItems}
          onRestore={handleToggleConsumed}
          onRestoreAll={handleRestoreAllShoppingItems}
          onSaveDetails={handleSaveShoppingListDetails}
        />
      ) : null}

      {loading ? <div className="card text-sm muted">{'\uC7AC\uB8CC\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...'}</div> : null}

      {!loading && !filteredIngredients.length ? (
        <EmptyState
          title={'\uD604\uC7AC \uC870\uAC74\uC5D0 \uB9DE\uB294 \uC7AC\uB8CC\uAC00 \uC5C6\uC5B4\uC694'}
          description={'\uD544\uD130\uB97C \uBC14\uAFB8\uAC70\uB098 \uC0C8 \uC7AC\uB8CC\uB97C \uCD94\uAC00\uD574\uC11C \uBAA9\uB85D\uC744 \uCC44\uC6CC\uBCF4\uC138\uC694.'}
        />
      ) : null}

      <IngredientList
        ingredients={filteredIngredients}
        onDelete={handleDelete}
        onToggleConsumed={handleToggleConsumed}
      />
    </div>
  );
}

export default IngredientsPage;
