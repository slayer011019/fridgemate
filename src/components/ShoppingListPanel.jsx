import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const EMPTY_DRAFT = { quantity: '', memo: '' };
const AUTO_SAVE_DELAY_MS = 450;
const SAVE_FEEDBACK_MS = 1400;

const SAVE_STATUS = {
  IDLE: 'idle',
  EDITING: 'editing',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error'
};

function getNormalizedDraft(item) {
  return {
    quantity: item.quantity || '',
    memo: item.memo || ''
  };
}

function isSameDraft(left = EMPTY_DRAFT, right = EMPTY_DRAFT) {
  return (left.quantity || '') === (right.quantity || '') && (left.memo || '') === (right.memo || '');
}

function isSameStateMap(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function getSaveStatusLabel(status) {
  if (status === SAVE_STATUS.EDITING) {
    return '입력 중';
  }

  if (status === SAVE_STATUS.SAVING) {
    return '저장 중';
  }

  if (status === SAVE_STATUS.SAVED) {
    return '저장됨';
  }

  if (status === SAVE_STATUS.ERROR) {
    return '저장 실패';
  }

  return '자동 저장';
}

function getSaveStatusClassName(status) {
  if (status === SAVE_STATUS.SAVING) {
    return 'text-brand-700';
  }

  if (status === SAVE_STATUS.SAVED) {
    return 'text-emerald-700';
  }

  if (status === SAVE_STATUS.ERROR) {
    return 'text-rose-700';
  }

  return 'muted';
}

const ShoppingListItemCard = memo(function ShoppingListItemCard({
  item,
  draft,
  saveStatus,
  onDelete,
  onDraftChange,
  onRestore
}) {
  return (
    <div className="rounded-[18px] border border-white/80 bg-white/75 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-900">{item.name}</p>
            <span className="badge bg-slate-200 text-slate-700">재등록 필요</span>
          </div>
          <p className="mt-1 text-sm muted">{item.category || '미분류'}</p>
        </div>
        <p className={`text-xs font-medium ${getSaveStatusClassName(saveStatus)}`}>{getSaveStatusLabel(saveStatus)}</p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          다음 구매 수량
          <input
            value={draft.quantity}
            onChange={(event) => onDraftChange(item.id, 'quantity', event.target.value)}
            placeholder="예: 2개, 1봉"
          />
        </label>

        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          장보기 메모
          <textarea
            rows="2"
            value={draft.memo}
            onChange={(event) => onDraftChange(item.id, 'memo', event.target.value)}
            placeholder="예: 할인하면 구매, 작은 사이즈 우선"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => onRestore(item)}>
          다시 채워짐
        </button>
        <button
          type="button"
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-full bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
          onClick={() => onDelete(item.id)}
        >
          완전 삭제
        </button>
      </div>
    </div>
  );
});

function ShoppingListPanel({ items, onDelete, onRestore, onRestoreAll, onSaveDetails }) {
  const [drafts, setDrafts] = useState({});
  const [saveStates, setSaveStates] = useState({});
  const draftsRef = useRef(drafts);
  const saveStatesRef = useRef(saveStates);
  const saveVersionRef = useRef({});
  const savedFeedbackTimersRef = useRef({});

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    saveStatesRef.current = saveStates;
  }, [saveStates]);

  useEffect(
    () => () => {
      Object.values(savedFeedbackTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  useEffect(() => {
    const itemIds = new Set(items.map((item) => item.id));

    setDrafts((current) => {
      const nextDrafts = {};

      items.forEach((item) => {
        const normalizedDraft = getNormalizedDraft(item);
        const currentStatus = saveStatesRef.current[item.id] || SAVE_STATUS.IDLE;

        if (!current[item.id] || currentStatus === SAVE_STATUS.IDLE || currentStatus === SAVE_STATUS.SAVED) {
          nextDrafts[item.id] = normalizedDraft;
          return;
        }

        nextDrafts[item.id] = current[item.id];
      });

      return nextDrafts;
    });

    setSaveStates((current) => {
      const nextStates = Object.fromEntries(Object.entries(current).filter(([id]) => itemIds.has(id)));
      return isSameStateMap(current, nextStates) ? current : nextStates;
    });

    Object.keys(savedFeedbackTimersRef.current).forEach((id) => {
      if (itemIds.has(id)) {
        return;
      }

      window.clearTimeout(savedFeedbackTimersRef.current[id]);
      delete savedFeedbackTimersRef.current[id];
      delete saveVersionRef.current[id];
    });
  }, [items]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'ko')),
    [items]
  );

  const markSavedTemporarily = useCallback((id) => {
    if (savedFeedbackTimersRef.current[id]) {
      window.clearTimeout(savedFeedbackTimersRef.current[id]);
    }

    savedFeedbackTimersRef.current[id] = window.setTimeout(() => {
      setSaveStates((current) => {
        if ((current[id] || SAVE_STATUS.IDLE) !== SAVE_STATUS.SAVED) {
          return current;
        }

        const nextStates = { ...current };
        nextStates[id] = SAVE_STATUS.IDLE;
        return nextStates;
      });

      delete savedFeedbackTimersRef.current[id];
    }, SAVE_FEEDBACK_MS);
  }, []);

  const persistDraft = useCallback(
    async (item, draft) => {
      const id = item.id;
      const nextVersion = (saveVersionRef.current[id] || 0) + 1;
      saveVersionRef.current[id] = nextVersion;

      if (savedFeedbackTimersRef.current[id]) {
        window.clearTimeout(savedFeedbackTimersRef.current[id]);
        delete savedFeedbackTimersRef.current[id];
      }

      setSaveStates((current) => ({
        ...current,
        [id]: SAVE_STATUS.SAVING
      }));

      try {
        await onSaveDetails({
          ...item,
          quantity: draft.quantity,
          memo: draft.memo
        });

        if (saveVersionRef.current[id] !== nextVersion) {
          return;
        }

        const currentDraft = draftsRef.current[id] || EMPTY_DRAFT;
        if (!isSameDraft(currentDraft, draft)) {
          setSaveStates((current) => ({
            ...current,
            [id]: SAVE_STATUS.EDITING
          }));
          return;
        }

        setSaveStates((current) => ({
          ...current,
          [id]: SAVE_STATUS.SAVED
        }));
        markSavedTemporarily(id);
      } catch {
        if (saveVersionRef.current[id] !== nextVersion) {
          return;
        }

        setSaveStates((current) => ({
          ...current,
          [id]: SAVE_STATUS.ERROR
        }));
      }
    },
    [markSavedTemporarily, onSaveDetails]
  );

  useEffect(() => {
    const itemsToSave = items
      .map((item) => {
        const draft = drafts[item.id];

        if (!draft) {
          return null;
        }

        const currentDraft = getNormalizedDraft(item);
        const saveStatus = saveStates[item.id] || SAVE_STATUS.IDLE;

        if (saveStatus !== SAVE_STATUS.EDITING && saveStatus !== SAVE_STATUS.ERROR) {
          return null;
        }

        if (isSameDraft(draft, currentDraft)) {
          return null;
        }

        return {
          item,
          draft
        };
      })
      .filter(Boolean);

    if (!itemsToSave.length) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      itemsToSave.forEach(({ item, draft }) => {
        void persistDraft(item, draft);
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [drafts, items, persistDraft, saveStates]);

  const handleDraftChange = useCallback((id, field, value) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || EMPTY_DRAFT),
        [field]: value
      }
    }));

    setSaveStates((current) => ({
      ...current,
      [id]: SAVE_STATUS.EDITING
    }));
  }, []);

  if (!items.length) {
    return null;
  }

  return (
    <section className="card bg-gradient-to-br from-amber-50/70 via-white/70 to-brand-50/50">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="kicker">다시 사야 할 재료</p>
          <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">장바구니처럼 모아두고 한 번에 다시 채워보세요</h3>
          <p className="max-w-2xl text-sm leading-6 muted">
            소비 처리한 재료를 따로 모아두고, 다음 장보기 전에 수량과 메모만 가볍게 정리할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge bg-amber-100 text-amber-800">{`재등록 필요 ${items.length}개`}</span>
          <button type="button" className="btn-secondary" onClick={onRestoreAll}>
            모두 다시 채워짐
          </button>
          <Link to="/ingredients/new" className="btn-secondary">
            새 재료 추가
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 xl:grid-cols-2">
        {sortedItems.map((item) => (
          <ShoppingListItemCard
            key={item.id}
            item={item}
            draft={drafts[item.id] || getNormalizedDraft(item)}
            saveStatus={saveStates[item.id] || SAVE_STATUS.IDLE}
            onDelete={onDelete}
            onDraftChange={handleDraftChange}
            onRestore={onRestore}
          />
        ))}
      </div>
    </section>
  );
}

export default memo(ShoppingListPanel);
