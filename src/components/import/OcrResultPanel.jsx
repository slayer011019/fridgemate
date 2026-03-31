function OcrResultPanel({
  status,
  progress,
  error,
  rawText,
  showRawText,
  onToggleRawText
}) {
  const progressPercent = Math.round((progress || 0) * 100);

  return (
    <section className="card space-y-4">
      <div>
        <p className="kicker">{'2. OCR \uACB0\uACFC'}</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uD14D\uC2A4\uD2B8\uB97C \uCD94\uCD9C\uD558\uACE0 \uAC00\uC838\uC624\uAE30 \uC804\uC5D0 \uD655\uC778\uD558\uC138\uC694'}</h3>
      </div>

      {status === 'processing' ? (
        <div className="soft-panel">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>{'OCR \uCC98\uB9AC \uC911'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
          {`\u004F\u0043\u0052 \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. ${error || '\uB354 \uC120\uBA85\uD55C \uC2A4\uD06C\uB9B0\uC0F7\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'}`}
        </div>
      ) : null}

      {status === 'success' && !rawText ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {'OCR\uC740 \uB05D\uB0AC\uC9C0\uB9CC \uC774\uBBF8\uC9C0\uC5D0\uC11C \uC77D\uC744 \uC218 \uC788\uB294 \uD14D\uC2A4\uD2B8\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694.'}
        </div>
      ) : null}

      {rawText ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary" onClick={onToggleRawText}>
              {showRawText ? '\uC6D0\uBCF8 OCR \uD14D\uC2A4\uD2B8 \uC228\uAE30\uAE30' : '\uC6D0\uBCF8 OCR \uD14D\uC2A4\uD2B8 \uBCF4\uAE30'}
            </button>
          </div>

          {showRawText ? (
            <pre className="max-h-72 overflow-auto rounded-[24px] bg-slate-950 p-4 text-xs text-slate-100">{rawText}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default OcrResultPanel;
