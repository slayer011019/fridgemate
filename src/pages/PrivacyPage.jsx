import PageHeader from '../components/PageHeader';

function PrivacyPage() {
  return (
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="안내"
        title="개인정보 처리 안내"
        description="오늘뭐먹지는 서비스 운영에 필요한 범위에서만 정보를 처리합니다."
      />

      <section className="card space-y-5 text-sm leading-7 text-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900">저장되는 정보</h2>
          <p className="mt-1">
            비로그인 상태의 냉장고 재료와 설정은 브라우저 저장소에 보관됩니다. 계정 기능을 사용할 때는 로그인과 동기화에 필요한 계정 정보와 사용자가 직접 등록한 재료 정보가 서버에 저장될 수 있습니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">서비스 분석과 오류 확인</h2>
          <p className="mt-1">
            서비스 품질 개선을 위해 화면 이용 흐름과 추천 반응 같은 비식별 이용 기록을 처리할 수 있습니다. 오류 수집 도구는 운영 환경에서 별도로 설정된 경우에만 동작합니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">광고와 쿠키</h2>
          <p className="mt-1">
            Google AdSense가 활성화되면 Google과 광고 파트너가 광고 제공, 빈도 조절, 성과 측정을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다. 광고 기능이 비활성화된 동안에는 AdSense 스크립트를 불러오지 않습니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">선택과 문의</h2>
          <p className="mt-1">
            브라우저 설정에서 쿠키와 로컬 데이터를 삭제하거나 차단할 수 있습니다. 계정 데이터 삭제와 개인정보 관련 문의 창구는 운영 정책 확정 후 이 페이지에 고지합니다.
          </p>
        </div>
        <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">시행일: 2026년 8월 22일</p>
      </section>
    </div>
  );
}

export default PrivacyPage;
