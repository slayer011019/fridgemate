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
import { useIngredients } from '../hooks/useIngredients';
import { isOcrEnabled } from '../utils/backendConfig';
import { ingredientCategories, storageTypes } from '../utils/ingredientOptions';

function IngredientsPage() {
  const { ingredients, loading, error, removeIngredient, updateIngredient } = useIngredients();
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
      } catch {
        // Error state is surfaced from the hook.
      }
    },
    [updateIngredient]
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
    <div className="space-y-5">
      <PageHeader
        eyebrow="재료 관리"
        title="보유 중인 재료를 쉽고 정돈되게 살펴보세요"
        description="냉장, 냉동, 팬트리로 나눠 보고 유통기한 순으로 정렬하면 무엇을 먼저 써야 할지 바로 파악할 수 있어요."
        action={
          <>
            {ocrEnabled ? (
              <Link to="/import" className="btn-secondary">
                스크린샷 불러오기
              </Link>
            ) : null}
            <Link to="/ingredients/new" className="btn-primary">
              재료 추가
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

      <section className="soft-panel flex flex-col gap-3 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="badge bg-white text-slate-700">{`현재 보유 ${activeIngredientCount}개`}</span>
          <span className="badge bg-white text-slate-700">{`필터 결과 ${filteredIngredients.length}개`}</span>
          <span className="badge bg-amber-100 text-amber-800">{`재구매 후보 ${shoppingListItems.length}개`}</span>
        </div>
        <p className="muted">가장 중요한 정보가 위쪽에 먼저 오도록 정렬해 두었어요.</p>
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

      {loading ? <div className="card text-sm muted">재료를 불러오는 중입니다...</div> : null}
      {error ? <div className="card border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

      {!loading && !filteredIngredients.length ? (
        <EmptyState
          title="현재 조건에 맞는 재료가 없어요"
          description="필터를 바꾸거나 새 재료를 추가해서 목록을 채워보세요."
        />
      ) : null}

      <IngredientList ingredients={filteredIngredients} onDelete={handleDelete} onToggleConsumed={handleToggleConsumed} />
    </div>
  );
}

export default IngredientsPage;
