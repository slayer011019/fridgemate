import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

function NotFoundPage() {
  return (
    <div className="section-shell mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="404"
        title="요청한 페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 존재하지 않는 페이지입니다. 홈에서 냉장고 관리와 메뉴 추천을 계속 이용할 수 있어요."
        action={
          <Link className="btn-primary" to="/">
            홈으로 이동
          </Link>
        }
      />
    </div>
  );
}

export default NotFoundPage;
