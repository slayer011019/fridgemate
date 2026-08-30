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
            분석을 허용한 로그인 사용자에 한해 화면·행동 유형, 개수, 범주화된 속성 같은 최소 이용 기록을
            계정과 연결해 저장할 수 있습니다. 이 수집은 운영자가 기능을 명시적으로 켠 경우에만 동작합니다. Google Analytics도
            분석을 허용한 경우에만 불러옵니다. 이메일과 재료명은 분석 이벤트로 수집하지 않고, 내부 사용자·세션 식별자는 외부
            분석 도구나 학습용 내보내기에 포함하지 않습니다. 분석 설정을 철회하면 브라우저 분석 식별자를 지우고 이후 수집을 중단합니다.
            오류 수집 도구(Sentry)는 운영 환경에 DSN이 별도로 설정된 경우에만 오류 진단 목적으로 동작합니다.
            오류 메시지와 스택 프레임 변수·주변 코드는 제거하고 오류 유형·스택 위치·발생 시각·릴리스·환경·SDK
            정보 같은 최소 진단 정보와 쿼리·해시·식별자를 없앤 같은 사이트의 경로 템플릿만 전송합니다. 세션·성능
            추적, 화면 리플레이와 로그 수집은 끕니다. SDK 이벤트의 사용자 계정 정보, 화면 이동·클릭·키 입력·네트워크
            요청 같은 breadcrumb, 추가 문맥, 요청 헤더·쿠키·본문은 전송 전에 제거합니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">선택형 외부 AI 처리</h2>
          <p className="mt-1">
            기본 재료 추천과 가져오기 교정은 외부 AI 없이 동작합니다. 외부 AI 기능은 운영자가 서버의 외부 데이터
            처리 게이트를 별도로 켜고, 화면에서 제공자와 전송 항목을 확인한 사용자가 해당 요청에 한해 동의하고
            버튼을 누른 경우에만 실행됩니다. 화면의 체크 값만을 보안 경계로 믿지 않으며 서버도 요청 목적과 최신
            고지 버전을 다시 확인합니다. 동의는 저장되지 않고 요청할 때마다 다시 선택해야 합니다.
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-slate-900">OpenAI</span>: 레시피 유사도 검색에는 활성 재료명을
              정규화해 만든 짧은 검색 문자열을 전송하고, 가져오기 교정 유사도 기능에는 원래·수정 상품명, 분류,
              보관 방식만 전송합니다. 목적은 일회성 임베딩 계산입니다. 원본 영수증 문장, 수량, 정확한 날짜,
              메모, 이메일은 보내지 않습니다. 현재 가져오기 화면은 교정 임베딩 전송 동작을 제공하지 않으므로
              자동 전송하지 않습니다.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Anthropic</span>: 별도의 AI 레시피 생성을 명시적으로
              요청할 때 활성 재료명과 유통기한 임박 여부만 전송합니다. 정확한 유통기한, 수량, 메모는 보내지
              않습니다. 목적은 해당 요청의 레시피 문안을 생성하는 것입니다.
            </li>
          </ul>
          <p className="mt-2">
            서버는 이메일, 전화번호, 주민등록번호 형태, 결제카드 번호, URL, 상세 주소처럼 보이는 문자열을 외부 AI
            입력에서 거부하고 길이와 개수를 제한합니다. 다만 자동 탐지가 모든 민감정보를 보장해 찾는 것은 아니므로
            재료명 칸에 개인정보를 입력하지 마세요.
          </p>
          <p className="mt-2">
            오늘뭐먹지는 외부 AI 전용 요청·응답 이력을 별도로 만들지 않습니다. 위에서 설명한 계정의 가져오기
            교정 기록은 서비스 기능을 위해 계속 저장될 수 있습니다. 제공자는 API 안전성 점검을 위해 입력·출력
            또는 관련 로그를 기본적으로 최대 30일 보관할 수 있으며, 법적 의무·오남용 조사 또는 별도 계약 설정에
            따라 달라질 수 있습니다. 최신 조건은{' '}
            <a
              className="font-medium text-brand-700 underline underline-offset-2"
              href="https://platform.openai.com/docs/models/default-usage-policies-by-endpoint"
              rel="noreferrer"
              target="_blank"
            >
              OpenAI 데이터 제어 안내
            </a>
            와{' '}
            <a
              className="font-medium text-brand-700 underline underline-offset-2"
              href="https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"
              rel="noreferrer"
              target="_blank"
            >
              Anthropic API 보관 안내
            </a>
            를 확인하세요.
          </p>
          <p className="mt-2">
            체크를 해제하거나 다음 요청에서 동의하지 않으면 이후 외부 전송이 중단됩니다. 이미 완료된 한 번의
            요청은 브라우저에서 되돌릴 수 없고, 제공자 측 삭제·만료는 위 정책과 계약에 따릅니다. 철회나 삭제에
            도움이 필요하면 아래 문의처로 요청할 수 있습니다.
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
            분석 수집을 운영 활성화할 때 적용할 보존 정책은 제품 이용 이벤트 최대 90일, 추천 상호작용 이벤트 최대
            180일입니다. 현재 저장소는 승인된 운영자가 실행하는 제한된 수동 정리 도구를 제공하며 자동 반복 실행은
            아직 구성하지 않았습니다. 과거 분석 결과를 내보낸 파일은 서비스 기능에 사용하지 않으며 목적을 달성한
            뒤 별도로 삭제합니다.{' '}
            재료를 삭제하면 이름, 수량, 분류, 보관 위치, 날짜, 메모 같은 내용은 브라우저와 서버에서 즉시
            제거합니다. 오래된 기기가 삭제 항목을 되살리지 못하도록 재료 식별자와 수정·삭제 시각, 로컬 동기화
            상태만 담은 최소 기록은 안전한 기기 checkpoint 방식이 마련될 때까지 자동 삭제하지 않습니다. 그 밖의
            브라우저 저장 정보는 사용자가 직접 삭제할 때까지 보관됩니다. 계정 화면에서 현재 비밀번호를 다시
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
