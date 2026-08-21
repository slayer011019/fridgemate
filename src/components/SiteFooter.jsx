import { Link } from 'react-router-dom';

function SiteFooter() {
  return (
    <footer className="app-footer">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <p>오늘뭐먹지</p>
        <nav aria-label="사이트 안내" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/about" className="font-medium text-slate-600 hover:text-slate-900">
            서비스 소개
          </Link>
          <Link to="/contact" className="font-medium text-slate-600 hover:text-slate-900">
            문의
          </Link>
          <Link to="/privacy" className="font-medium text-slate-600 hover:text-slate-900">
            개인정보 처리 안내
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default SiteFooter;
