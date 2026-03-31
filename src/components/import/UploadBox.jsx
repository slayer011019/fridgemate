function UploadBox({ imagePreviewUrl, fileName, disabled, onChange, onRunOcr }) {
  return (
    <section className="card space-y-4">
      <div>
        <p className="kicker">{'1. \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC'}</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">{'\uC8FC\uBB38 \uB0B4\uC5ED \uB610\uB294 \uC601\uC218\uC99D \uC2A4\uD06C\uB9B0\uC0F7'}</h3>
        <p className="mt-2 text-sm leading-6 muted">
          {'\uC7A5\uBCF4\uAE30 \uC8FC\uBB38 \uD654\uBA74\uC774\uB098 \uC601\uC218\uC99D \uC774\uBBF8\uC9C0\uB97C \uC62C\uB9AC\uBA74 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C OCR\uB85C \uD14D\uC2A4\uD2B8\uB97C \uCD94\uCD9C\uD569\uB2C8\uB2E4.'}
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-brand-100 bg-brand-50/40 px-6 py-10 text-center hover:border-brand-500 hover:bg-brand-50/70">
        <span className="text-sm font-semibold text-slate-800">{'\uC774\uBBF8\uC9C0 \uD30C\uC77C \uC120\uD0DD'}</span>
        <span className="mt-1 text-xs muted">{'PNG, JPG, WEBP \uC2A4\uD06C\uB9B0\uC0F7'}</span>
        <input type="file" accept="image/*" className="hidden" onChange={onChange} />
      </label>

      {fileName ? <p className="text-sm muted">{`\uC120\uD0DD\uD55C \uD30C\uC77C: ${fileName}`}</p> : null}

      {imagePreviewUrl ? (
        <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/70">
          <img src={imagePreviewUrl} alt={'\uC5C5\uB85C\uB4DC\uD55C \uC2A4\uD06C\uB9B0\uC0F7 \uBBF8\uB9AC\uBCF4\uAE30'} className="max-h-[26rem] w-full object-contain" />
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">
        {'\uD31D: \uC0C1\uD488\uBA85\uACFC \uC218\uB7C9\uC774 \uD06C\uAC8C \uBCF4\uC774\uB294 \uC8FC\uBB38 \uB0B4\uC5ED \uC601\uC5ED\uB9CC \uCEA1\uCC98\uD558\uBA74 OCR \uC815\uD655\uB3C4\uAC00 \uB354 \uC88B\uC544\uC838\uC694.'}
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={onRunOcr} disabled={disabled}>
          {'\uC774\uBBF8\uC9C0\uC5D0\uC11C \uD14D\uC2A4\uD2B8 \uCD94\uCD9C'}
        </button>
      </div>
    </section>
  );
}

export default UploadBox;
