import PageHeader from '../components/PageHeader';

function AboutPage() {
  return (
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="오늘뭐먹지"
        title="냉장고 속 재료를 식사로 이어주는 서비스"
        description="보유 재료와 유통기한을 한곳에서 관리하고, 남은 재료를 활용할 수 있는 메뉴를 찾도록 돕습니다."
      />

      <section className="card space-y-5 text-sm leading-7 text-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900">서비스가 해결하려는 문제</h2>
          <p className="mt-1">
            장을 본 뒤 잊고 있던 재료가 버려지거나, 냉장고에 재료가 있어도 무엇을 만들지 결정하기 어려운 순간을 줄이는 것이 오늘뭐먹지의 목표입니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">추천 기준</h2>
          <p className="mt-1">
            등록한 재료의 보유 여부와 유통기한, 기본 양념 보유 상태를 바탕으로 바로 만들기 좋은 메뉴와 조금만 더 준비하면 되는 메뉴를 구분합니다. 추천 결과는 식품 안전이나 영양·의료 조언을 대신하지 않습니다.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">운영 원칙</h2>
          <p className="mt-1">
            필요한 정보만 처리하고, 비로그인 사용자의 재료 정보는 기본적으로 해당 브라우저에 저장합니다. 서비스 관련 의견과 오류 제보는 공개 문의 창구를 통해 받고 있습니다.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;
