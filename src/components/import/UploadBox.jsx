function UploadBox({ imagePreviewUrl, fileName, disabled, onChange, onRunOcr }) {
  return (
    <section className="card">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
        <div className="space-y-4">
          <div>
            <p className="kicker">1. 이미지 업로드</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">주문 내역 또는 영수증 스크린샷</h3>
            <p className="mt-2 text-sm leading-6 muted">
              장보기 주문 화면이나 영수증 이미지를 올리면 브라우저에서 OCR로 텍스트를 추출합니다.
            </p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-brand-100 bg-brand-50/40 px-5 py-8 text-center hover:border-brand-500 hover:bg-brand-50/70">
            <span className="text-sm font-semibold text-slate-800">이미지 파일 선택</span>
            <span className="mt-1 text-xs muted">PNG, JPG, WEBP 스크린샷</span>
            <input type="file" accept="image/*" className="hidden" onChange={onChange} />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={onRunOcr} disabled={disabled}>
              이미지에서 텍스트 추출
            </button>
            {fileName ? <p className="text-sm muted">{`선택한 파일: ${fileName}`}</p> : null}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            팁: 상품명과 수량이 크게 보이는 주문 내역 영역만 캡처하면 OCR 정확도가 더 좋아져요.
          </p>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-white/70 bg-white/70">
          {imagePreviewUrl ? (
            <img src={imagePreviewUrl} alt="업로드한 스크린샷 미리보기" className="max-h-[24rem] w-full object-contain" />
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center bg-slate-50/70 px-6 text-center text-sm muted">
              이미지를 올리면 이곳에 미리보기가 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default UploadBox;
