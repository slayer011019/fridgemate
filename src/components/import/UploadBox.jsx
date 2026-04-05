function UploadBox({ imagePreviewUrl, fileName, disabled, onChange, onRunOcr }) {
  return (
    <section className="card">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
        <div className="space-y-4">
          <div>
            <p className="kicker">{'1. \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC'}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
              {'\uC8FC\uBB38 \uB0B4\uC5ED \uB610\uB294 \uC601\uC218\uC99D \uC2A4\uD06C\uB9B0\uC0F7'}
            </h3>
            <p className="mt-2 text-sm leading-6 muted">
              {
                '\uC7A5\uBCF4\uAE30 \uC8FC\uBB38 \uD654\uBA74\uC774\uB098 \uC601\uC218\uC99D \uC774\uBBF8\uC9C0\uB97C \uC62C\uB9AC\uBA74 \uBE0C\uB77C\uC6B0\uC800 \uC548\uC5D0\uC11C OCR\uB85C \uD14D\uC2A4\uD2B8\uB97C \uCD94\uCD9C\uD569\uB2C8\uB2E4.'
              }
            </p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-brand-100 bg-brand-50/40 px-5 py-8 text-center hover:border-brand-500 hover:bg-brand-50/70">
            <span className="text-sm font-semibold text-slate-800">{'\uC774\uBBF8\uC9C0 \uD30C\uC77C \uC120\uD0DD'}</span>
            <span className="mt-1 text-xs muted">{'PNG, JPG, WEBP \uC2A4\uD06C\uB9B0\uC0F7'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={onChange} />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={onRunOcr} disabled={disabled}>
              {'\uC774\uBBF8\uC9C0\uC5D0\uC11C \uD14D\uC2A4\uD2B8 \uCD94\uCD9C'}
            </button>
            {fileName ? <p className="text-sm muted">{`\uC120\uD0DD\uD55C \uD30C\uC77C: ${fileName}`}</p> : null}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            {
              '\uC8FC\uBB38 \uB0B4\uC5ED\uC5D0\uC11C \uC0C1\uD488\uBA85\uACFC \uC218\uB7C9\uC774 \uD070 \uAD6C\uC5ED\uB9CC \uCEA1\uCC98\uD558\uBA74 OCR \uC815\uD655\uB3C4\uAC00 \uB354 \uC88B\uC544\uC9C8 \uC218 \uC788\uC5B4\uC694.'
            }
          </p>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-white/70 bg-white/70">
          {imagePreviewUrl ? (
            <img
              src={imagePreviewUrl}
              alt={'\uC5C5\uB85C\uB4DC\uD55C \uC2A4\uD06C\uB9B0\uC0F7 \uBBF8\uB9AC\uBCF4\uAE30'}
              className="max-h-[24rem] w-full object-contain"
            />
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center bg-slate-50/70 px-6 text-center text-sm muted">
              {'\uC774\uBBF8\uC9C0\uB97C \uC62C\uB9AC\uBA74 \uC5EC\uAE30\uC5D0 \uBBF8\uB9AC\uBCF4\uAE30\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default UploadBox;
