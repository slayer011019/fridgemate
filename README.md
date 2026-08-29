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
- `httpOnly` 쿠키, 단일 사용 refresh token 회전, CSRF origin 검증
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
- Vitest, React Testing Library, Playwright, ESLint, GitHub Actions CI
- 공개 서비스·연락처·개인정보처리방침·식약처 레시피 상세·사이트맵·`ads.txt`

### 검색 노출 경계

- 홈, 메뉴 추천, 서비스 소개, 문의, 개인정보 처리 안내와 식약처 공개 레시피 100개는 빌드 시 본문과 경로별 메타·JSON-LD를 HTML로 프리렌더합니다.
- 재료, OCR 가져오기, 로그인, 회원가입, 계정 화면은 Vercel `X-Robots-Tag`와 `robots.txt`에서 색인을 차단합니다.
- `npm run build`의 postbuild 단계는 공개 HTML의 `h1`, canonical, structured data와 기능 화면의 빈 `noindex` 앱 셸을 자동 검증합니다.
- 재료별 공개 허브 6개와 냉장고 활용 가이드 2개를 포함해 총 113개 공개 URL을 프리렌더하며, `/recipes`에서 100개 레시피 상세 URL을 모두 내부 링크합니다.
- `VITE_GA_MEASUREMENT_ID`가 설정되어도 이용자가 분석을 허용하기 전에는 Google Analytics를 불러오지 않습니다.
- 브라우저에서는 화면별 코드를 지연 로딩하고, SEO 사전 렌더링은 별도의 동기식 서버 엔트리를 사용해 공개 HTML 본문을 그대로 유지합니다.
- `llms.txt`는 공개 정보와 사용자별 비공개 영역의 경계를 설명하며, 개인정보나 개인화 추천 데이터는 인용 대상으로 제공하지 않습니다.
- 공개 레시피 상세 페이지의 `Recipe` JSON-LD에는 실제 원문에 있는 재료·조리 단계·이미지·영양·출처만 넣고 평점이나 조리 시간은 추정하지 않습니다.

공개 레시피 카탈로그는 `npm run recipes:export-public -- --limit=100 --write`로 식품안전나라 `COOKRCP01` 원문에서 갱신합니다. 쓰기 옵션을 빼면 파일을 바꾸지 않는 사전 점검으로 동작하며, 공개 조건을 충족하지 못한 항목은 제외합니다.

아직 운영 단계가 아닙니다.

- 자동 백그라운드 및 실시간 동기화
- 공유 냉장고와 다중 사용자 협업
- 사용자별 팬트리 상태의 서버 영속화
- 행동 데이터를 학습한 ML 순위 모델
- 전체 레시피 임베딩 재생성 및 semantic API 공개
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

동일한 동기화를 반복해도 `clientId` 기준으로 중복 생성되지 않으며, 삭제 시각보다 오래된 다른 기기의 데이터는 삭제 항목을 되살리지 못합니다. 자동 업로드는 아직 하지 않습니다.

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
API_SLOW_REQUEST_MS=1500
```

주의 사항:

- 서비스 역할 키와 AI API 키는 서버에서만 사용합니다.
- 비밀값에 `VITE_` 접두사를 붙이지 않습니다.
- `RECIPE_EMBEDDING_DIMENSIONS`는 DB의 `recipe_embeddings.embedding` 차원과 같아야 합니다.
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

대량 작업 전에는 checkpoint를 만들고, API batch·재시도·재개 상태를 사용하는 명령으로 실행합니다. checkpoint 파일에는 원시 벡터가 있으므로 `.local/` 또는 별도의 보호된 로컬 경로에만 보관합니다.

```bash
npm run recipes:checkpoint -- --dry-run
npm run recipes:checkpoint -- --label=before-staged-backfill
npm run recipes:embed -- --backfill-missing --all --batch-size=25 --api-batch-size=25 --max-writes=25 --quiet
npm run recipes:embed -- --backfill-missing --all --resume --batch-size=25 --api-batch-size=25 --max-writes=25 --quiet
npm run recipes:verify-embeddings -- --expect-recipes=1166 --expect-embeddings=1028 --expect-current=45 --expect-missing=138 --expect-stale=983
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

현재 저장 운영 벡터의 읽기 전용 평가는 Hit@1 `9/10`, Hit@5 `10/10`으로 운영 기준 `7/10`을 통과했습니다. 전체 카탈로그는 MFDS 1,146개와 재료 행을 갖춘 `curated_home_v1` 20개를 합친 1,166개입니다. checkpoint 이후 별도로 승인된 25-row missing batch 여섯 번과 마지막 13-row batch가 실패 없이 완료되어 현재 기준점은 `embeddings=1,166`, `current=183`, `missing=0`, `stale=983`, 중복 0, 고아 0, `vector(1536)`입니다. 남은 983건의 stale embedding은 별도 승인된 단계별 교체 전까지 보류하며, semantic 추천 API는 전체 freshness와 최종 무결성·품질 재검증 이후에만 공개합니다. 상세 기준은 [레시피 검색 품질 문서](docs/RECIPE_SEARCH_QUALITY.md), 운영 기록은 [임베딩 운영 기록](docs/RECIPE_EMBEDDING_OPERATIONS.md)에 있습니다.

## 추천 이벤트 내보내기

추천 노출·클릭 이벤트를 향후 오프라인 분석용 JSONL 또는 CSV로 내보낼 수 있습니다.

```bash
npm run export:recommendation-training -- --format=jsonl --output=data/training/recommendation-training.jsonl
npm run export:recommendation-training -- --format=csv --output=data/training/recommendation-training.csv
```

이 데이터는 자동 학습에 사용되지 않으며, 일반 앱 실행에도 필요하지 않습니다.

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

Playwright는 local-only 핵심 흐름과 API 모드의 로그인, 동기화, 삭제 충돌, 네트워크 실패, 세션 만료 흐름을 확인합니다.

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
- [배포 체크리스트](docs/DEPLOY_CHECKLIST.md)
- [AdSense 설정](docs/ADSENSE_SETUP.md)
- [AI 기능과 안전 경계](docs/AI_FEATURES.md)
- [레시피 데이터 가져오기](docs/recipe-seeding.md)
- [로드맵](docs/ROADMAP.md)
- [변경 이력](CHANGELOG.md)

## 다음 단계

1. 수동 동기화를 운영 DB와 여러 실제 기기에서 제한적으로 검증
2. 확대된 검색 fixture에서도 Hit@5 품질 기준 유지
3. checkpoint 후 제한적 임베딩 backfill과 저장 벡터 무결성 점검
4. semantic 추천 API와 규칙 기반 reranking 연결
5. 충분한 행동 데이터가 쌓인 뒤 추천 가중치 또는 순위 모델 검토

## 기여하기

기여는 언제든 환영합니다. [CONTRIBUTING.md](CONTRIBUTING.md)를 확인한 뒤 이슈 또는 Pull Request를 등록해 주세요.

처음 기여하기 좋은 영역:

- 문서와 테스트 보강
- 접근성 및 반응형 UI 개선
- OCR 파서 회귀 사례 추가
- 재료 분류와 추천 점수 설명 개선

## 라이선스

이 프로젝트는 [MIT License](LICENSE)로 배포됩니다.
