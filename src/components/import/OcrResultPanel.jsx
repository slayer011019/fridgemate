function OcrResultPanel({ status, progress, error, rawText, showRawText, onToggleRawText }) {
  const progressPercent = Math.round((progress || 0) * 100);
  const isIdle = status === 'idle' && !rawText && !error;

  if (isIdle) {
    return (
      <section className="soft-panel flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="kicker">{'2. OCR \uACB0\uACFC'}</p>
          <p className="mt-1 text-sm text-slate-700">
            {'\uC774\uBBF8\uC9C0\uB97C \uC62C\uB9AC\uACE0 OCR\uC744 \uC2E4\uD589\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uCD94\uCD9C \uACB0\uACFC\uAC00 \uBC14\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
          </p>
        </div>
        <span className="badge bg-slate-100 text-slate-600">{'\uB300\uAE30 \uC911'}</span>
      </section>
    );
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">{'2. \uC77D\uC740 \uB0B4\uC6A9 \uD655\uC778'}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 sm:text-[1.35rem]">
            {'\uC571\uC774 \uCC3E\uC740 \uC7AC\uB8CC \uD6C4\uBCF4\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694'}
          </h3>
        </div>
        {rawText ? (
          <button type="button" className="btn-secondary" onClick={onToggleRawText}>
            {showRawText ? '\uC6D0\uBCF8 \uC77D\uAE30 \uACB0\uACFC \uC228\uAE30\uAE30' : '\uC6D0\uBCF8 \uC77D\uAE30 \uACB0\uACFC \uBCF4\uAE30'}
          </button>
        ) : null}
      </div>

      {status === 'processing' ? (
        <div className="soft-panel">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>{'\uC0AC\uC9C4\uC5D0\uC11C \uC7AC\uB8CC \uCC3E\uB294 \uC911'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-700">
          {`\uC0AC\uC9C4\uC744 \uC77D\uB294 \uB370 \uC2E4\uD328\uD588\uC5B4\uC694. ${error || '\uB354 \uC120\uBA85\uD55C \uC0AC\uC9C4\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694.'}`}
        </div>
      ) : null}

      {status === 'success' && !rawText ? (
        <div className="rounded-[18px] border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800">
          {'\uC0AC\uC9C4\uC744 \uC77D\uAE30\uB294 \uD588\uC9C0\uB9CC \uC7AC\uB8CC\uB85C \uBCF4\uC774\uB294 \uB0B4\uC6A9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694.'}
        </div>
      ) : null}

      {showRawText && rawText ? (
        <pre className="max-h-56 overflow-auto rounded-[18px] bg-slate-950 p-3 text-xs text-slate-100">{rawText}</pre>
      ) : null}
    </section>
  );
}

export default OcrResultPanel;
