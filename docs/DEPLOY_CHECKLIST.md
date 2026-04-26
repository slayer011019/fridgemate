# Deployment Checklist

FridgeMate deployment verification checklist for Vercel, Railway, and end-to-end fallback behavior.

## 환경변수 계약
- [ ] Vercel: `VITE_API_URL`, `VITE_ENABLE_OCR`, `VITE_SENTRY_DSN` 확인
- [ ] Railway: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ALLOWED_ORIGINS`, `CLIENT_ORIGIN`, `ANTHROPIC_API_KEY` 확인
- [ ] `JWT_SECRET`가 비어 있지 않은지 확인
- [ ] `ALLOWED_ORIGINS`에 실제 프론트엔드 도메인이 포함되어 있는지 확인

## 로컬 전용 모드
- [ ] `VITE_API_URL=` 상태에서 메인 페이지 로드 확인
- [ ] 재료 추가/수정/삭제 동작 확인
- [ ] 페이지 새로고침 후 IndexedDB 데이터 유지 확인
- [ ] `/recipes` 페이지 추천 동작 확인
- [ ] `/import` 페이지 OCR review-before-save 동작 확인

## 백엔드 연결 모드
- [ ] `GET /health` 200 응답 확인
- [ ] `/health` 응답의 `db` 값 확인
- [ ] 로그인 없이 guest 모드 재료 CRUD가 계속 로컬에서 동작하는지 확인
- [ ] 로그인 후 `/account` 접근 및 사용자 범위(`user:<id>`) 표시 확인
- [ ] 로그인 후 재료 추가/수정/삭제가 API 기준으로 동작하는지 확인
- [ ] `/recipes` 보호 API 호출이 정상 동작하는지 확인

## 인증과 fallback
- [ ] 보호 라우트 접근 시 `/login`으로 리다이렉트되는지 확인
- [ ] 로그인 성공 후 원래 요청 경로로 복귀하는지 확인
- [ ] `/auth/me`가 401/403일 때 세션이 정리되고 다시 로그인 요구가 뜨는지 확인
- [ ] 네트워크 실패 또는 5xx 시 기존 로컬 세션과 캐시를 유지하는지 확인
- [ ] guest import prompt에서 가져오기 / 유지하기 흐름 확인

## 동기화와 캐시
- [ ] 성공한 API 읽기/쓰기가 authenticated IndexedDB cache로 미러링되는지 확인
- [ ] 서버에서 사라진 clean local item이 다음 동기화 때 제거되는지 확인
- [ ] 더 최신인 local cached item이 pending update로 유지되는지 확인
- [ ] API 5xx 또는 네트워크 실패 시 authenticated cache fallback 배너가 보이는지 확인

## 빠른 점검 스크립트와 자동화
- [ ] `scripts/smoke-test.sh` 실행
- [ ] `npm run test:e2e` 실행
- [ ] Playwright core 5 scenarios 결과 확인
- [ ] SPA 라우팅과 모바일 반응형 최종 점검

## 선택: Sentry 연동 준비
- [ ] `VITE_SENTRY_DSN` 환경변수 등록
- [ ] `npm install @sentry/react` 실행
- [ ] [src/main.jsx](/Users/lee/fridgemate/src/main.jsx)에 표시된 위치에 `Sentry.init()` 추가
- [ ] Sentry 프로젝트/DSN은 직접 생성 후 연결

### 권장 초기화 예시
```jsx
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN
  });
}
```

### 참고 링크
- Sentry React SDK package: `@sentry/react`
- Sentry docs: https://docs.sentry.io/platforms/javascript/guides/react/
- Sentry init options: https://docs.sentry.io/platforms/javascript/configuration/options/#dsn
