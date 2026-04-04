# Deployment Checklist

FridgeMate deployment verification checklist for Vercel, Railway, and end-to-end fallback behavior.

## 프론트엔드 (Vercel)
- [ ] 메인 페이지 로드 확인
- [ ] 재료 추가/수정/삭제 동작 확인 (로컬 모드)
- [ ] 페이지 새로고침 후 데이터 유지 확인 (IndexedDB)
- [ ] `/recipes` 페이지에서 추천 동작 확인
- [ ] `/import` 페이지에서 OCR 동작 확인
- [ ] SPA 라우팅: 직접 URL 접근 시 404 안 나는지
- [ ] 모바일 반응형 확인
- [ ] `VITE_API_URL` 설정 시 백엔드 연동 확인

## 백엔드 (Railway)
- [ ] `GET /health` 200 응답 확인
- [ ] DB 연결 상태 확인
- [ ] CORS: 프론트엔드 도메인에서 API 호출 가능
- [ ] 재료 CRUD API 동작 확인
- [ ] 레시피 추천 API 동작 확인

## 통합
- [ ] 프론트에서 백엔드 API로 재료 추가 -> DB 저장 확인
- [ ] 백엔드 중단 시 프론트가 로컬 모드로 fallback
- [ ] 재접속 시 로컬 데이터 <-> 서버 데이터 충돌 없음

## 빠른 점검 스크립트
- [ ] `scripts/smoke-test.sh` 실행
- [ ] 프론트 URL 2xx/3xx 응답 확인
- [ ] 백엔드 `/health` 200 응답 확인
- [ ] `/health` 응답의 `db` 값 확인

## 선택: Sentry 연동 준비
- [ ] `VITE_SENTRY_DSN` 환경변수 등록
- [ ] `npm install @sentry/react` 실행
- [ ] [src/main.jsx](/c:/Users/lee/workspace/FridgeMate/src/main.jsx)에 표시된 위치에 `Sentry.init()` 추가
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
