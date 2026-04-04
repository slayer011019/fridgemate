function OcrResultPanel({ status, progress, error, rawText, showRawText, onToggleRawText }) {
  const progressPercent = Math.round((progress || 0) * 100);

  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">2. OCR 결과</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">텍스트를 추출하고 가져오기 전에 확인하세요</h3>
        </div>
        {rawText ? (
          <button type="button" className="btn-secondary" onClick={onToggleRawText}>
            {showRawText ? '원본 OCR 텍스트 숨기기' : '원본 OCR 텍스트 보기'}
          </button>
        ) : null}
      </div>

      {status === 'processing' ? (
        <div className="soft-panel">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>OCR 처리 중</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
          {`OCR 처리에 실패했어요. ${error || '더 선명한 스크린샷으로 다시 시도해주세요.'}`}
        </div>
      ) : null}

      {status === 'success' && !rawText ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          OCR은 끝났지만 이미지에서 읽을 수 있는 텍스트를 찾지 못했어요.
        </div>
      ) : null}

      {showRawText && rawText ? (
        <pre className="max-h-72 overflow-auto rounded-[20px] bg-slate-950 p-4 text-xs text-slate-100">{rawText}</pre>
      ) : null}
    </section>
  );
}

export default OcrResultPanel;
