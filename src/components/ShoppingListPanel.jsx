import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const PRIORITY_STORAGE_KEY = 'fridgemate-shopping-priority';

function getInitialPriorityMap() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRIORITY_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const EMPTY_DRAFT = { quantity: '', memo: '' };

const ShoppingListItemCard = memo(function ShoppingListItemCard({
  item,
  draft,
  isPriority,
  onDraftChange,
  onTogglePriority,
  onSaveDetails,
  onRestore
}) {
  return (
    <div className={`rounded-[22px] border p-4 ${isPriority ? 'border-amber-200 bg-amber-50/70' : 'border-white/80 bg-white/75'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-900">{item.name}</p>
            {isPriority ? <span className="badge bg-amber-100 text-amber-800">{'우선 사야 함'}</span> : null}
          </div>
          <p className="mt-1 text-sm muted">{item.category || '재료'}</p>
        </div>
        <span className="badge bg-slate-200 text-slate-700">{'재등록 필요'}</span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'다음에 살 수량'}
          <input value={draft.quantity} onChange={(event) => onDraftChange(item.id, 'quantity', event.target.value)} placeholder="예: 2개, 1봉" />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          {'장보기 메모'}
          <textarea
            rows="2"
            value={draft.memo}
            onChange={(event) => onDraftChange(item.id, 'memo', event.target.value)}
            placeholder="예: 할인하면 사기, 큰 사이즈 말고 작은 걸로"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => onTogglePriority(item.id)}>
          {isPriority ? '우선순위 해제' : '우선 사야 함'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            onSaveDetails({
              ...item,
              quantity: draft.quantity,
              memo: draft.memo
            })
          }
        >
          {'장보기 메모 저장'}
        </button>
        <button type="button" className="btn-primary" onClick={() => onRestore(item)}>
          {'다시 채워짐'}
        </button>
        <Link className="btn-secondary" to={`/ingredients/${item.id}/edit`}>
          {'상세 수정'}
        </Link>
      </div>
    </div>
  );
});

function ShoppingListPanel({ items, onRestore, onRestoreAll, onSaveDetails }) {
  const [drafts, setDrafts] = useState({});
  const [priorityMap, setPriorityMap] = useState(getInitialPriorityMap);

  useEffect(() => {
    setDrafts(
      items.reduce((nextDrafts, item) => {
        nextDrafts[item.id] = {
          quantity: item.quantity || '',
          memo: item.memo || ''
        };
        return nextDrafts;
      }, {})
    );
  }, [items]);

  useEffect(() => {
    const activeIds = new Set(items.map((item) => item.id));
    const nextPriorityMap = Object.fromEntries(Object.entries(priorityMap).filter(([id]) => activeIds.has(id)));

    if (Object.keys(nextPriorityMap).length !== Object.keys(priorityMap).length) {
      setPriorityMap(nextPriorityMap);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(nextPriorityMap));
      }
    }
  }, [items, priorityMap]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const leftPriority = priorityMap[left.id] ? 1 : 0;
        const rightPriority = priorityMap[right.id] ? 1 : 0;

        if (leftPriority !== rightPriority) {
          return rightPriority - leftPriority;
        }

        return String(left.name || '').localeCompare(String(right.name || ''), 'ko');
      }),
    [items, priorityMap]
  );

  if (!items.length) {
    return null;
  }

  const persistPriorityMap = useCallback((nextPriorityMap) => {
    setPriorityMap(nextPriorityMap);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(nextPriorityMap));
    }
  }, []);

  const handleDraftChange = useCallback((id, field, value) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || EMPTY_DRAFT),
        [field]: value
      }
    }));
  }, []);

  const handleTogglePriority = useCallback((id) => {
    const nextPriorityMap = { ...priorityMap };

    if (nextPriorityMap[id]) {
      delete nextPriorityMap[id];
    } else {
      nextPriorityMap[id] = true;
    }

    persistPriorityMap(nextPriorityMap);
  }, [persistPriorityMap, priorityMap]);

  const handleRestore = useCallback((item) => {
    const nextPriorityMap = { ...priorityMap };
    delete nextPriorityMap[item.id];
    persistPriorityMap(nextPriorityMap);
    onRestore(item);
  }, [onRestore, persistPriorityMap, priorityMap]);

  const handleRestoreAll = useCallback(() => {
    persistPriorityMap({});
    onRestoreAll();
  }, [onRestoreAll, persistPriorityMap]);

  return (
    <section className="card bg-gradient-to-br from-amber-50/70 via-white/70 to-brand-50/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="kicker">다시 사야 할 재료</p>
          <h3 className="text-2xl font-semibold text-slate-900">장바구니처럼 모아두고 한 번에 다시 채워보세요</h3>
          <p className="max-w-2xl text-sm leading-6 muted">
            이미 다 쓴 재료를 따로 모아둔 영역이에요. 팬트리처럼 평소 보유를 설정하는 곳이 아니라, 다음 장보기 때 다시 사야 하는 목록에
            가까워요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge bg-amber-100 text-amber-800">{`재등록 필요 ${items.length}개`}</span>
          <span className="badge bg-white text-slate-600">{`우선 사야 함 ${Object.keys(priorityMap).length}개`}</span>
          <button type="button" className="btn-secondary" onClick={handleRestoreAll}>
            {'모두 다시 채워짐'}
          </button>
          <Link to="/ingredients/new" className="btn-secondary">
            {'새 재료 추가'}
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sortedItems.map((item) => (
          <ShoppingListItemCard
            key={item.id}
            item={item}
            draft={drafts[item.id] || EMPTY_DRAFT}
            isPriority={Boolean(priorityMap[item.id])}
            onDraftChange={handleDraftChange}
            onTogglePriority={handleTogglePriority}
            onSaveDetails={onSaveDetails}
            onRestore={handleRestore}
          />
        ))}
      </div>
    </section>
  );
}

export default memo(ShoppingListPanel);
