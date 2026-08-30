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
            비로그인 상태의 냉장고 재료와 설정은 브라우저 저장소에 보관됩니다. 계정 기능을 사용할 때는 이메일,
            로그인 세션, 사용자가 동기화한 재료, 가져오기 교정 기록, 계정에 연결된 추천 반응 기록이 서버에 저장될
            수 있습니다. 비밀번호는 원문이 아닌 단방향 해시로 저장합니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">내 데이터 확인과 내려받기</h2>
          <p className="mt-1">
            로그인한 사용자는 계정 화면에서 서버에 저장된 계정 정보, 재료, 가져오기 교정 기록, 계정에 연결된 추천
            이벤트를 JSON 파일로 내려받을 수 있습니다. 인증 토큰, 로그인 세션 해시, 비밀번호 해시는 내보내지
            않습니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">서비스 분석과 오류 확인</h2>
          <p className="mt-1">
            서비스 품질 개선을 위해 화면 이용 흐름과 추천 반응 같은 비식별 이용 기록을 처리할 수 있습니다. Google Analytics는 이용자가 분석을 허용한 경우에만 불러오며, 오늘뭐먹지 내부 사용자 ID와 이메일은 분석 도구로 전송하지 않습니다. 분석 설정은 사이트 하단에서 언제든 변경할 수 있습니다. 오류 수집 도구는 운영 환경에서 별도로 설정된 경우에만 동작합니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">광고와 쿠키</h2>
          <p className="mt-1">
            사이트 확인을 위해 Google AdSense 스크립트를 불러옵니다. 광고가 활성화되면 Google과 광고 파트너가 광고 제공, 빈도 조절, 성과 측정을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">보관과 삭제</h2>
          <p className="mt-1">
            브라우저에 저장된 정보는 사용자가 직접 삭제할 때까지 보관됩니다. 계정 화면에서 현재 비밀번호를 다시
            확인한 뒤 계정을 삭제하면 운영 데이터베이스의 계정과 연결 데이터, 해당 기기의 계정 전용 재료 캐시를
            삭제하고 로그인 쿠키를 만료합니다. 삭제 시점 이전의 제한된 백업 사본은 서비스 제공자의 보호된 백업
            보관 주기에 따라 만료되며 일반 서비스 기능에서는 조회하거나 복원하지 않습니다. 관계 법령상 별도 보관
            의무가 생기는 정보는 그 범위와 기간에 한해 분리 보관할 수 있습니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">선택과 문의</h2>
          <p className="mt-1">
            브라우저 설정에서 쿠키와 로컬 데이터를 직접 삭제하거나 차단할 수 있습니다. 다른 기기에 남은 로컬
            데이터는 각 기기의 브라우저 사이트 데이터를 삭제해야 합니다.
          </p>
          <p className="mt-2">
            계정 화면을 사용할 수 없거나 개인정보 관련 도움이 필요하면{' '}
            <a className="font-medium text-brand-700 underline underline-offset-2" href="mailto:ibaekgom@gmail.com">
              ibaekgom@gmail.com
            </a>
            으로 보내주세요.
          </p>
        </div>
        <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">시행일: 2026년 8월 30일</p>
      </section>
    </div>
  );
}

export default PrivacyPage;
