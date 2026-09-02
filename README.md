# 오늘뭐먹지 (FridgeMate)

냉장고 속 재료와 유통기한을 관리하고, 지금 가진 재료로 만들기 좋은 메뉴를 추천하는 로컬 우선 웹 애플리케이션입니다.

- 공개 서비스: [https://오늘뭐먹지.com](https://오늘뭐먹지.com)
- 현재 마일스톤: `v1.5`
- 라이선스: [MIT](LICENSE)

## 프로젝트 소개

냉장고에 무엇이 있는지 잊거나, 유통기한을 놓치거나, 남은 재료로 무엇을 먹을지 결정하지 못하는 문제를 줄이는 것이 목표입니다.

핵심 사용 흐름은 다음과 같습니다.

```text
재료 등록 -> 유통기한 확인 -> 메뉴 추천 -> 외부 레시피 확인 -> 재료 소비/복구
```

브라우저의 IndexedDB를 일상적인 작업 사본으로 사용하므로 가입하지 않아도 주요 기능을 사용할 수 있습니다. 로그인한 사용자는 계정 화면에서 서버 백업과 가져오기를 직접 실행할 수 있습니다.

## 주요 기능

### 냉장고와 장보기

- 재료 이름, 수량, 분류, 보관 위치, 구매일, 유통기한, 메모 관리
- D-day 기반 임박·만료 상태 표시
- 재료 소비와 복구, 다시 살 항목을 위한 장보기 패널
- 자주 쓰는 양념과 소스의 팬트리 보유 상태 관리
- 네트워크 없이도 동작하는 IndexedDB 기반 로컬 모드

### 등록과 OCR

- 사진과 영수증 형태의 텍스트를 읽는 Tesseract.js OCR
- 인식 결과를 바로 저장하지 않고 사용자가 검토한 뒤 반영
- 반복 교정을 재사용하는 가져오기 교정 학습

### 레시피 추천

- 바로 만들기, 하나만 더 사기, 임박 재료 활용 추천 그룹
- 보유 재료, 팬트리 재료, 유통기한 임박도를 반영한 규칙 기반 점수
- PostgreSQL 레시피 카탈로그와 pgvector 임베딩을 이용한 후보 검색 기반
- 추천 노출과 클릭 이벤트 저장 및 학습 데이터 내보내기
- 식품안전나라 원문에서 공개용으로 선별한 레시피 100개와 재료·조리 단계·영양 정보 상세 페이지
- 각 상세 페이지의 canonical URL, 사이트맵 항목, 출처 기반 `Recipe` JSON-LD

### 계정과 동기화

- JWT 기반 회원가입, 로그인, 로그아웃, 세션 복구
- `httpOnly` 쿠키, 단일 사용 refresh token 회전, 사용자별 24건 제한 session history, CSRF origin 검증
- 사용자 범위를 강제하는 조회·수정·삭제와 PostgreSQL RLS
- 계정 화면에서 실행하는 수동 서버 백업과 가져오기
- `clientId + updatedAt + deletedAt` 기반 레코드별 충돌 해결
- 네트워크 오류와 5xx에서 로컬 변경 및 재시도 상태 보존
- 4xx 오류를 성공으로 처리하지 않고 사용자에게 표시

## 현재 구현 상태

구현되어 있습니다.

- 게스트용 local-only CRUD와 오프라인 사용
- 선택형 Express API 및 Cloudflare Workers 실행 경로
- Prisma + PostgreSQL/Supabase 데이터 계층
- 충돌을 고려한 수동 재료 동기화와 삭제 tombstone
- OCR 등록, 검토, 교정 학습
- 규칙 기반 추천과 DB·임베딩 혼합 후보 검색
- 추천 이벤트 수집 및 데이터 내보내기
- 게스트·로그인 사용자별 오늘 메뉴 선택, 완료, 취소와 실패 후 재시도 기반
- 사용자별 팬트리·간단 취향 저장과 멱등 제품 이벤트 API
- Vitest, React Testing Library, Playwright, ESLint, GitHub Actions CI
- 공개 서비스·연락처·개인정보처리방침·식약처 레시피 상세·사이트맵·`ads.txt`

### 검색 노출 경계

- 홈, 메뉴 추천, 서비스 소개, 문의, 개인정보 처리 안내와 식약처 공개 레시피 100개는 빌드 시 본문과 경로별 메타·JSON-LD를 HTML로 프리렌더합니다.
- 재료, OCR 가져오기, 로그인, 회원가입, 계정 화면은 Vercel `X-Robots-Tag`와 `robots.txt`에서 색인을 차단합니다.
- `npm run build`의 postbuild 단계는 공개 HTML의 `h1`, canonical, structured data와 기능 화면의 빈 `noindex` 앱 셸을 자동 검증합니다.
- Google, 네이버, Bing의 URL-prefix 소유권 인증은 각각 `VITE_GOOGLE_SITE_VERIFICATION`, `VITE_NAVER_SITE_VERIFICATION`, `VITE_BING_SITE_VERIFICATION` 값이 있을 때 정적 `<meta>` 태그로 빌드되고 postbuild에서 검증됩니다.
- 재료별 공개 허브 6개와 냉장고 활용 가이드 2개를 포함해 총 113개 공개 URL을 프리렌더하며, `/recipes`에서 100개 레시피 상세 URL을 모두 내부 링크합니다.
- `VITE_GA_MEASUREMENT_ID`가 설정되어도 이용자가 분석을 허용하기 전에는 Google Analytics를 불러오지 않습니다.
- 브라우저에서는 화면별 코드를 지연 로딩하고, SEO 사전 렌더링은 별도의 동기식 서버 엔트리를 사용해 공개 HTML 본문을 그대로 유지합니다.
- `llms.txt`는 공개 정보와 사용자별 비공개 영역의 경계를 설명하며, 개인정보나 개인화 추천 데이터는 인용 대상으로 제공하지 않습니다.
- 공개 레시피 상세 페이지의 `Recipe` JSON-LD에는 실제 원문에 있는 재료·조리 단계·이미지·영양·출처만 넣고 평점이나 조리 시간은 추정하지 않습니다.

공개 레시피 카탈로그는 식품안전나라 `COOKRCP01` 원문을 곧바로 소스 파일에 쓰지 않습니다. 먼저 `npm run recipes:export-public -- --limit=100 --print-review > public-recipes.review.json`으로 검토 파일을 만들고 내용을 확인한 뒤, `npm run recipes:export-public -- --write-from=public-recipes.review.json`으로 갱신합니다. 검토 파일과 저장소의 기존 출력 파일은 심볼릭 링크나 하드 링크가 아닌 일반 파일이어야 하며, 스크립트는 검증한 파일 핸들에만 읽고 씁니다. 공개 조건을 충족하지 못한 항목은 제외합니다.

운영용 MFDS seed와 재료 parser도 기본값은 dry run입니다. 실제 Supabase 쓰기는 `--execute`와 현재 `SUPABASE_URL`의 정확한 `--confirm-project-ref`를 함께 지정해야 하며, 자세한 절차는 [레시피 데이터 가져오기](docs/recipe-seeding.md)에 정리되어 있습니다.

현재 공개 운영 서비스의 범위 밖입니다.

- 자동 백그라운드 및 실시간 동기화
- 공유 냉장고와 다중 사용자 협업
- 행동 데이터를 학습한 ML 순위 모델
- 별도 staging 검증을 마친 semantic 추천의 운영 활성화
- 새 메뉴·이벤트·개인화 migration의 staging 및 운영 적용
- 광범위한 브라우저·실기기 E2E

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | React, Vite, JavaScript, Tailwind CSS |
| 상태·로컬 저장 | React Context, custom hooks, IndexedDB |
| 백엔드 | Express, Cloudflare Workers |
| 데이터베이스 | Prisma, PostgreSQL, Supabase, pgvector |
| 인증 | JWT, `httpOnly` cookies, refresh token rotation, PostgreSQL RLS |
| OCR | Tesseract.js |
| 선택형 AI | Anthropic API, OpenAI-compatible embedding API |
| 테스트 | Vitest, React Testing Library, Playwright |
| 배포 | Vercel, Cloudflare, Supabase |

## 아키텍처

```text
React UI
  -> hooks / API clients
  -> IndexedDB 작업 사본
  -> 선택형 Express 또는 Cloudflare Workers API
  -> Prisma
  -> PostgreSQL / Supabase
```

### 재료 저장

```text
사용자 작업
  -> IndexedDB에 생성·수정·삭제 상태 저장
  -> pendingCreate / pendingUpdate / pendingDelete 유지
  -> React 화면 갱신
```

### 수동 동기화

```text
서버 백업
  -> pending 레코드와 tombstone 전송
  -> 서버가 userId + clientId 범위에서 최신 변경 적용
  -> 전체 서버 상태를 updatedAt 기준으로 로컬에 병합

서버 가져오기
  -> 서버 레코드와 tombstone 조회
  -> 최신 pending 로컬 변경 보존
  -> 서버에서 삭제된 깨끗한 로컬 캐시 제거
```

동일한 동기화를 반복해도 `clientId` 기준으로 중복 생성되지 않습니다. 삭제에는 명시적 복원 동작이 아직 없으므로 tombstone이 활성 레코드보다 항상 우선하며, 기기 시계가 더 최신인 오래된 편집도 삭제 항목을 되살리지 못합니다. 삭제 즉시 이름, 수량, 분류, 보관 위치, 날짜, 메모 같은 업무 payload는 IndexedDB와 서버에서 제거되고 `id`, `clientId`, `userId`(서버), `updatedAt`, `deletedAt`, 로컬 동기화 상태만 남습니다. 이 최소 tombstone은 안전한 서버 세대 번호/checkpoint 프로토콜이 도입되기 전까지 자동으로 물리 삭제하지 않습니다. 자동 업로드는 아직 하지 않습니다.

자세한 내용은 [아키텍처 문서](docs/ARCHITECTURE.md)를 참고하세요.

## 빠른 시작

요구 사항:

- Node.js `24` 권장
- npm
- 백엔드 모드 사용 시 PostgreSQL

의존성을 설치합니다.

```bash
npm install
```

환경 설정 예시를 복사합니다.

```bash
cp .env.example .env
```

프론트엔드 local-only 모드를 실행합니다.

```bash
npm run dev
```

기본 주소는 `http://localhost:5173`입니다.

백엔드 모드를 함께 사용할 때는 별도 터미널에서 실행합니다.

```bash
npm run dev:server
npm run dev
```

백엔드 상태 확인 주소:

```text
http://localhost:4000/health
http://localhost:4000/api/health
```

## 환경 변수

전체 목록과 설명은 [.env.example](.env.example)과 [server/.env.example](server/.env.example)에 있습니다. 실제 키와 데이터베이스 주소는 커밋하지 마세요.

주요 프론트엔드 변수:

```env
VITE_API_URL=
VITE_ENABLE_OCR=true
VITE_SENTRY_DSN=
VITE_ADSENSE_VERIFICATION_ENABLED=true
VITE_ADSENSE_SERVING_ENABLED=false
```

주요 백엔드 변수:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
RECIPE_EMBEDDING_MODEL=text-embedding-3-small
RECIPE_EMBEDDING_DIMENSIONS=1536
AI_USAGE_LOGGING_ENABLED=false
SEMANTIC_RECIPE_API_ENABLED=false
API_SLOW_REQUEST_MS=1500
```

주의 사항:

- 서비스 역할 키와 AI API 키는 서버에서만 사용합니다.
- 비밀값에 `VITE_` 접두사를 붙이지 않습니다.
- 가입 제한은 실제 클라이언트 주소와 정규화 이메일 조합을 사용합니다. 로그인은 여기에 정규화 이메일 기준 30회/시간 공용 예산을 더해 다중 주소 추측을 제한합니다.
- AI·semantic 추천은 사용자 및 클라이언트 주소별로 제한합니다. semantic 추천은 요청 재료가 없을 때 최근 저장 재료를 최대 50개만 처리하고 기본 가중 비용 5를 양쪽 예산에서 차감합니다.
- OCR 교정 제안·저장 API는 처리 항목 수만큼 공용 예산을 차감합니다. 사용자 기준 분당 60개·시간당 180개, 클라이언트 주소 기준 분당 600개·시간당 1,800개를 넘으면 `429`와 `Retry-After`를 반환합니다.
- 서버 사용자 정보는 `localStorage`에 보관하지 않습니다. 시작할 때 HttpOnly 갱신 쿠키로 세션을 다시 확인하며, 확인 실패 시 사용자 전용 로컬 캐시를 잠급니다. 서버 로그아웃 결과를 확인하지 못하면 대기 표식을 남겨 다음 연결에서 로그아웃 상태를 다시 확인합니다.
- 로그인 사용자는 `GET /api/auth/data-export`로 비밀번호·세션 비밀값을 제외한 자기 데이터를 내려받을 수 있습니다. `DELETE /api/auth/account`는 현재 비밀번호 재확인, 사용자·클라이언트 주소별 시도 제한, RLS 사용자 범위 정책을 거쳐 계정과 연결 데이터를 한 트랜잭션에서 삭제합니다.
- 계정 화면에서 삭제가 성공하면 현재 기기의 해당 계정 전용 IndexedDB 재료 캐시도 지웁니다. 다른 기기의 로컬 저장소는 해당 기기에서 사이트 데이터를 별도로 삭제해야 합니다.
- `RECIPE_EMBEDDING_DIMENSIONS`는 DB의 `recipe_embeddings.embedding` 차원과 같아야 합니다.
- `SEMANTIC_RECIPE_API_ENABLED`는 운영 임베딩 무결성과 검색 품질을 확인한 뒤에만 `true`로 전환합니다. 명시적 API는 `POST /api/recipes/recommendations/semantic`이며 인증과 요청 제한을 적용합니다.
- 핵심 앱 기능은 AI API 키 없이도 동작합니다.
- API 오류 응답에는 지원 추적용 request ID가 포함되며, 선택형 AI 사용량 로그에는 프롬프트·재료명·벡터 없이 모델, 건수, 토큰, 지연시간과 설정된 경우의 추정 비용만 기록합니다.

## 데이터베이스

Prisma schema 검증과 Client 생성:

```bash
npm run prisma:validate
npm run prisma:generate
```

로컬 migration 생성·적용:

```bash
npm run prisma:migrate
```

운영 migration은 배포 체크리스트와 SQL을 검토한 뒤 별도 작업으로 수행합니다.

```bash
npm run prisma:deploy
```

이 명령은 개발·테스트 과정에서 자동으로 실행하지 않습니다.

운영 백업 존재 여부와 PITR 설정은 Supabase Dashboard 또는 Management API의 직접 증거로 확인해야 합니다. 운영 DB를 덮어쓰지 않는 별도 프로젝트 복구 훈련과 RLS 검증 절차는 [백업·복구 런북](docs/BACKUP_RESTORE_RUNBOOK.md)을 따릅니다.

예약 백업 워크플로는 현재 Supabase 서버와 같은 PostgreSQL 17 `pg_dump`/`pg_restore`를 명시적으로 사용합니다. Supabase가 PostgreSQL major 버전을 올리면 백업 클라이언트 major도 함께 갱신해야 합니다.

Free 플랜에서 수동 논리 백업을 준비할 때는 전용 암호화 디렉터리를 저장소 밖에 먼저 만들고 다음 읽기 전용 preflight를 실행합니다. 이 명령은 `BACKUP_DATABASE_URL` 또는 `DIRECT_URL`의 비밀번호를 출력하지 않으며, transaction pooler, 다른 Supabase project ref, 저장소 내부·symlink·비어 있지 않은 출력 경로, 미설치 Supabase CLI/Docker를 거부합니다.

```bash
npm run backup:preflight -- --output-dir=ABSOLUTE_ENCRYPTED_DIRECTORY --confirm-database-host=EXACT_DB_HOST --confirm-encrypted-storage
```

preflight 성공은 백업 완료가 아닙니다. 실제 dump와 별도 프로젝트 복구는 [백업·복구 런북](docs/BACKUP_RESTORE_RUNBOOK.md)의 승인·검증 단계를 거쳐야 합니다.

## 레시피 임베딩과 검색

임베딩 저장은 모델 훈련이 아닙니다. 레시피 제목·설명·분류된 재료를 벡터로 변환해 semantic 후보를 가져오고, 최종 순위는 재료 일치도와 유통기한 규칙으로 다시 계산합니다.

현재 source of truth:

- 레시피: UUID 기반 `recipes`
- 재료: `recipe_ingredients`
- 벡터: `recipe_embeddings`
- 검색 연결: `recipe_embeddings.recipe_id -> recipes.id`

임베딩 명령은 기본적으로 쓰지 않는 안전 모드입니다.

```bash
npm run recipes:embed -- --dry-run --limit=10
```

제한적 운영 backfill은 조회 범위와 실제 쓰기 상한을 분리합니다. `--all`은 실행 시점의 전체 카탈로그 수를 자동으로 읽으며, 실제 쓰기에서는 유한한 `--max-writes`가 없으면 실행 자체를 거부합니다.

품질 fixture에 포함된 레시피만 선택적으로 점검할 때는 `--target-fixture`를 사용합니다. 이 모드는 fixture의 `id` 또는 `externalId`를 실제 카탈로그와 대조하고 이름 불일치·누락·중복을 거부하며, 실제 쓰기에서는 `--all`과 마찬가지로 `--max-writes`가 필수입니다.

대량 작업 전에는 checkpoint를 만들고, API batch·재시도·재개 상태를 사용하는 명령으로 실행합니다. checkpoint 파일에는 원시 벡터가 있으므로 `.local/` 또는 별도의 보호된 로컬 경로에만 보관합니다. 운영 1,166개 backfill은 완료됐으며 아래 명령은 재실행 지시가 아니라 복구·운영 절차의 참고입니다.

```bash
npm run recipes:checkpoint -- --dry-run
npm run recipes:verify-embeddings -- --expect-recipes=1166 --expect-embeddings=1166 --expect-current=1166 --expect-missing=0 --expect-stale=0
```

실제 backfill은 `.local/recipe-embedding-backfill-state.json`에 마지막으로 안전하게 반영된 UUID를 기록합니다. `--resume`은 operation, model, dimension이 일치할 때만 이 위치부터 keyset pagination으로 재개합니다. 429, 5xx, 네트워크 오류는 지수 backoff로 재시도하며 4xx는 즉시 실패합니다. 요약에는 API 입력·요청·재시도·예상 토큰·처리량만 표시되고 비밀값과 원시 벡터는 표시되지 않습니다.

고정 fixture를 이용한 읽기 전용 품질 평가:

```bash
npm run recipes:embed -- --evaluate --dry-run --limit=1166
npm run recipes:embed -- --evaluate --execute --limit=1166 --output=docs/recipe-search-quality-report.json
```

실제 보유 재료 3~5개, 임박 재료, `계란`/`달걀`과 `파`/`대파` 동의어를 포함한 20개 한국 가정식 fixture도 별도로 유지합니다.

```bash
npm run recipes:embed -- --evaluate --dry-run --stored-vectors --limit=1166 --fixture=scripts/fixtures/recipe-search-home-meal-evaluation.json
```

전체 카탈로그는 MFDS 1,146개와 재료 행을 갖춘 `curated_home_v1` 20개를 합친 1,166개입니다. 운영 임베딩은 `current=1,166`, `missing=0`, `stale=0`, 중복 0, 고아 0, `vector(1536)`로 검증됐습니다. 최종 저장 벡터 평가는 고정 10-query Hit@5 `9/10`, 한국 가정식 20-query 후보 100개 재현율 `19/20`, 70/30 재정렬 Hit@5 `15/20`을 기록했습니다. 벡터 단독 한국 가정식 Hit@5는 `12/20`이므로 pgvector는 후보 생성에만 사용하고 재료·유통기한 규칙 재정렬을 유지합니다. 상세 기준은 [레시피 검색 품질 문서](docs/RECIPE_SEARCH_QUALITY.md), 운영 기록은 [임베딩 운영 기록](docs/RECIPE_EMBEDDING_OPERATIONS.md)에 있습니다.

## 추천 이벤트 내보내기

추천 노출부터 선택, 관심 없음, 외부 링크, 조리 완료까지의 퍼널을 오프라인 분석용 JSONL 또는 CSV로 내보낼 수 있습니다. 내보내기는 사용자·세션 식별자를 결과 파일에서 제외하고 recipe key 형식과 catalog FK 연결률을 집계해 표시합니다.

```bash
npm run export:recommendation-training -- --format=jsonl --output=data/training/recommendation-training.jsonl
npm run export:recommendation-training -- --format=csv --output=data/training/recommendation-training.csv
```

기본 조회 범위는 실행 시각까지 최근 180일입니다. 재현 가능한 과거 구간은 `--since=2026-03-03T00:00:00.000Z --until=2026-08-30T00:00:00.000Z`처럼 명시할 수 있으며, 180일보다 넓은 범위와 미래 종료 시각은 거부됩니다. 두 쿼리 모두 클라이언트 시각이 아닌 서버 `createdAt` 경계를 사용합니다.

이 데이터는 자동 학습에 사용되지 않으며, 일반 앱 실행에도 필요하지 않습니다.

## 이벤트 보존 작업

계정 연결 원본 ProductEvent 90일, RecommendationEvent 180일 보존 정책을 적용하기 위한 수동 운영 도구입니다. 과거의 `userId IS NULL` 추천 이벤트는 현재 수집 경로에서 새로 생길 수 없는 legacy 행이므로 같은 bounded 작업에서 우선 정리합니다. 현재 저장소에는 반복 scheduler가 없으므로 이 명령을 한 번 추가한 것만으로 보존기간이 자동 집행되지는 않습니다.

```bash
# DIRECT_URL 또는 별도 EVENT_RETENTION_DATABASE_URL을 사용하는 읽기 전용 미리보기
npm run events:prune-retention

# 출력된 정확한 호스트를 확인한 뒤에만 실제 삭제
npm run events:prune-retention -- --apply --confirm-database-host=DB_HOST
```

작업은 기본 500행 배치, 실행당 최대 5,000행, 30초 제한으로 동작합니다. `--batch-size`, `--max-delete`, `--max-runtime-ms`로 더 작은 운영 한도를 정할 수 있지만 코드의 상한을 넘길 수 없습니다. 배포 API의 runtime `DATABASE_URL`과 tenant RLS에 묶인 앱 역할은 이 작업에 허용되지 않으며, 로그에는 보존 정책과 테이블별 집계만 기록됩니다. 반복 집행은 별도 권한 검토를 거친 scheduler가 배포되기 전까지 승인된 운영자가 이 명령을 실행하고 결과를 확인해야 합니다.

## 기존 재료 tombstone payload 정리

`20260830190000`~`20260830192000` 세 migration은 활성 레코드 CHECK 추가, 일반 DML을 막지 않는 제약 검증, 짧은 payload 컬럼 nullable 전환을 순서대로 수행합니다. 기존 삭제 행은 변경하지 않습니다. 세 migration을 모두 적용한 뒤 scrub-aware 서버를 배포하고 구 서버 인스턴스가 모두 종료된 것을 확인한 다음, 새 프런트엔드를 배포해야 합니다. 그 뒤에만 기존 full tombstone을 제한된 수동 작업으로 정리합니다.

```bash
# DIRECT_URL 또는 별도 INGREDIENT_TOMBSTONE_SCRUB_DATABASE_URL을 사용하는 읽기 전용 미리보기
npm run ingredients:scrub-tombstones

# 출력된 정확한 호스트를 확인한 뒤 실제 payload NULL 처리
npm run ingredients:scrub-tombstones -- --apply --confirm-database-host=DB_HOST
```

기본 한도는 500행 배치, 실행당 5,000행, 30초이며 `--batch-size`, `--max-update`, `--max-runtime-ms`로 더 작게 조정할 수 있습니다. 각 배치는 별도 DB 작업으로 커밋되고, `id`, `clientId`, `userId`, `updatedAt`, `deletedAt`은 변경하지 않으며 행을 삭제하지 않습니다. 로그는 대상 호스트와 집계만 포함합니다. `mayHaveMore` 또는 `remainingEligibleCount`가 남으면 승인된 운영자가 다시 실행해야 하며, 이 도구는 자동 반복 작업이 아닙니다.

## 검사와 테스트

필수 검사:

```bash
npm run lint
npm run test:run
npm run build
npm run prisma:validate
```

선택 검사:

```bash
npm run test:coverage
npm run test:e2e
npm run worker:dry-run
```

Playwright는 local-only 핵심 흐름과 API 모드의 로그인, 동기화, 삭제 충돌, 네트워크 실패, 세션 만료 흐름을 확인합니다. 오늘 메뉴 선택·재시도 E2E는 새 migration의 staging 적용 후 최종 운영 게이트로 실행합니다.

## 주요 디렉터리

```text
FridgeMate/
|-- .github/              # 이슈·PR 템플릿과 CI
|-- docs/                 # 아키텍처, 배포, AI, 품질 문서
|-- e2e/                  # Playwright 테스트
|-- prisma/               # schema와 migrations
|-- scripts/              # seed, embedding, 평가, export
|-- server/src/           # Express/Workers 백엔드
|-- src/                  # React 애플리케이션
|-- .env.example
|-- package.json
`-- README.md
```

## 배포와 운영 문서

- [Cloudflare 배포](docs/CLOUDFLARE_DEPLOYMENT.md)
- [Semantic staging 실행 절차](docs/STAGING_SEMANTIC_RUNBOOK.md)
- [배포 체크리스트](docs/DEPLOY_CHECKLIST.md)
- [AdSense 설정](docs/ADSENSE_SETUP.md)
- [AI 기능과 안전 경계](docs/AI_FEATURES.md)
- [레시피 데이터 가져오기](docs/recipe-seeding.md)
- [로드맵](docs/ROADMAP.md)
- [변경 이력](CHANGELOG.md)

## 다음 단계

1. 별도 Supabase·Cloudflare staging을 만들고 공개 레시피 카탈로그만 복사해 semantic 품질·fallback·인증·요청 제한을 검증
2. staging 통과 후 운영 Worker의 semantic flag만 제한적으로 활성화하고 24시간 오류·fallback·지연·API 사용량 관찰
3. `MenuDecision`, 추천 이벤트 FK, 팬트리·취향·제품 이벤트 migration을 staging에서 검토하고 메뉴 선택 E2E 통과
4. 운영 migration을 별도 승인·적용한 뒤 하루 한 개 메뉴 선택 루프와 행동 이벤트 수집 활성화
5. 최소 30일·5,000 impressions·500 selections/completions 이후에만 popularity/CTR 보정을 검토

## 기여하기

기여는 언제든 환영합니다. [CONTRIBUTING.md](CONTRIBUTING.md)를 확인한 뒤 이슈 또는 Pull Request를 등록해 주세요.

처음 기여하기 좋은 영역:

- 문서와 테스트 보강
- 접근성 및 반응형 UI 개선
- OCR 파서 회귀 사례 추가
- 재료 분류와 추천 점수 설명 개선

## 라이선스

이 프로젝트는 [MIT License](LICENSE)로 배포됩니다.
