import PageHeader from '../components/PageHeader';

function ContactPage() {
  return (
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="고객 지원"
        title="문의"
        description="서비스 이용, 오류 제보, 계정 및 개인정보 관련 요청을 이메일로 접수합니다."
      />

      <section className="card space-y-4 text-sm leading-7 text-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900">이메일 문의</h2>
          <p className="mt-1">
            <a className="font-medium text-brand-700 underline underline-offset-2" href="mailto:ibaekgom@gmail.com">
              ibaekgom@gmail.com
            </a>
          </p>
        </div>
        <p>
          오류를 제보할 때는 문제가 발생한 화면과 상황을 함께 적어주세요. 비밀번호, 인증 코드, 결제 정보 같은 민감한 정보는 이메일에 포함하지 마세요.
        </p>
      </section>
    </div>
  );
}

export default ContactPage;
