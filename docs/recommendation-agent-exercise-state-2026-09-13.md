# 루트 작업 보존 및 추천 정책 실습 상태

확인일: 2026-09-13 KST. 보존 브랜치: `codex/weekly-meal-plan`.

이 기록은 루트에 남은 변경을 확인하고 커밋·push하는 작업이다. 추천 중복 버그를 해결한 결과가 아니다. main 병합·운영 배포·실제 모델 API 호출은 이번 작업에 포함하지 않는다.

## 보존한 내용과 main의 관계

- 작업 시작 HEAD는 `cbd6eb7e0ce7f949f01ac44dc017719f72465348`이었다. 미커밋 애드센스 코드·문서와 추천 실습 3개 파일을 기존 내용 그대로 보존한다.
- 애드센스 코드 상당 부분은 이미 main의 PR #42에 통합됐다. 허브·가이드·구조화 데이터·편집 설명 6개 파일은 검토 시 main과 바이트 단위로 같았다. 이 커밋은 새로운 운영 기능 배포가 아닌 로컬 작업 이력 보존이다.
- 루트의 상세 페이지·SEO 검증기·추천 구현은 최신 main의 후속 개선이 빠진 중간 상태다. 전체 파일을 main 위에 덮어쓰면 준비 체크리스트, 강화된 스크립트 검사, 선호도 점수 및 catalog adapter 재료 보존 등을 잃을 수 있다.
- 원격 재확인 시 main은 `986051a`(주간 식단 PR #48 통합)에 도달했다. 이 보존 브랜치는 main이나 PR #48의 통합 브랜치가 아니며, 그대로 병합·배포할 대상으로 취급하지 않는다.
- 애드센스 문서는 각 날짜의 관찰 기록이다. 9월 6일의 미완료 항목과 9월 8일의 후속 결과를 오늘의 운영/Google 심사 상태라고 해석하지 않는다. 이번에 운영 사이트나 Google 계정을 재점검하지 않았다.
- `.agents/`, `skills-lock.json`, 디자인 제안 문서는 이번 커밋에서 제외하고 로컬에 그대로 남겼다. 별도 학습용 실행기와 보관 스냅샷도 변경하지 않았다.

## 실습 정책과 미수정 상태

기존 정규화 규칙에서 같은 이름이 핵심 재료와 필수 양념에 모두 있으면 추천 계산에서 핵심 재료로 한 번만 취급해야 한다. 없을 때는 `missingCore`에만 표시하며 다른 필수 양념의 누락은 유지한다. `requiredSeasonings`와 대체 입력 `pantryIngredients`를 모두 검사한다.

현재 구현은 아직 이 정책을 충족하지 않는다. 기존 테스트에 기록된 출력 동작을 이번 정책에서 변경하는 것이며, 이전 테스트를 공식적인 과거 제품 명세로 단정하지 않는다. 조리법 원본의 용도·분량이나 별칭·가중치·선택/액체/미분류 충돌 정책은 변경하지 않았다.

아래 세 파일은 기존 ready 스냅샷과 SHA-256이 정확히 같다. 이번 보존 작업에서는 구현이나 테스트 내용을 수정하지 않았다. HEAD 대비 구현 diff는 앞서 미커밋으로 남았던 빈 재고·팬트리·부족 재료 안내 개선이며, 핵심 우선 중복 정책의 정답 패치가 아니다.

| 파일 | SHA-256 |
| --- | --- |
| `src/utils/recommendations.js` | `ba43711cce5a96dfe94c7eb20ff4cab49b423ba57454abd50ac50e2ddd3ecbf1` |
| `src/utils/__tests__/recommendations.test.js` | `9c0d8d04c6859c4ef7c55185bc91aa8043b23ebb4cd214b57b78f80c83d1bdab` |
| `src/utils/__tests__/recommendations.agent-regression.test.js` | `e7c2609e07c177d35be673be8946ee2578852c63f3a6fe840921119b63468de8` |

## 이번 검증 결과

기존 설치 의존성을 교체하지 않고 Node 24.19.0 / Vitest 4.1.2 / Vite 8.2.2로 실행했다. 과거 ready 검증의 Node 20과 런타임은 다르지만 아래 정책 실패 결과는 동일하다.

| 검사 | 실제 결과 |
| --- | --- |
| 기존 recommendations 파일 | 32개 중 31개 통과, 소금 `missingSeasonings` assertion 1개 예상 실패 |
| 새 agent-regression 파일 | 24개 중 정상 입력 8개 통과, 중복 사례 16개 예상 실패 |
| 실습 합계 | 56개 중 39개 통과·17개 실패, skip/todo 없음, 종료 코드 1 |
| 루트 전체 테스트 | 92파일 중 90파일 통과·실습 2파일 실패. 519개 중 502개 통과·동일한 17개 실패, 종료 코드 1 |
| ESLint | 통과 |
| 빌드 및 SEO postbuild | 통과. 공개 경로 113개·사이트맵·noindex 앱 셸 검사 통과 |

실습 실패는 점수·매칭 목록·부족 양념의 `AssertionError`이며 import/환경 오류가 아니다. 실행 파일 목록에는 루트만 있고 `.worktrees/**`는 없었다. 전체 실행에서도 예상 밖 실패나 Prisma 오류는 나타나지 않았다. 이전 Prisma 실패의 원인은 이 결과만으로 확정하거나 해결됐다고 단정하지 않으며, Prisma·인증·DB 코드는 수정하지 않았다.

빌드는 최초 제한 환경에서 로컬 WebSocket 권한 경고를 냈지만 허용된 환경에서 재실행하여 해당 경고 없이 통과했다. 오래된 Browserslist 데이터 경고와 일부 기존 React 테스트의 `act` 경고는 남아 있다. 이를 없애려고 의존성을 갱신하지 않았다. 브라우저 E2E는 이번 보존 작업에서 재실행하지 않았으며 PR #48의 별도 통합 검증과 혼동하지 않는다.

재현 명령(다른 작업 트리가 중첩된 루트에서는 제외 옵션을 유지한다):

```sh
npm run test:run -- src/utils/__tests__/recommendations.test.js src/utils/__tests__/recommendations.agent-regression.test.js --exclude '.worktrees/**'
npm run test:run -- --exclude '.worktrees/**'
npm run lint -- --ignore-pattern '.worktrees/**'
npm run build
```

두 테스트 명령의 실패 종료는 지금의 실습 출발점이다. 구현을 고치거나 기대값을 낮추거나 skip/설정 변경으로 숨기지 않았다. 최종 통과를 요구하는 일반 제품 PR에 이 상태를 혼합하지 않는다.

## 자료 보존과 재현 경계

- 변경 전 대상 18개 파일 사본: `/private/tmp/fridgemate-root-changes-tdSWbs/before-commit-files.tar.gz`.
- 이번 검사 JSON: 같은 폴더의 `recommendations-tests.json`, `all-tests.json`. 원본 보고서는 덮어쓰지 않았다.
- 이전 실습 스냅샷: `/private/tmp/fridgemate-agent-regression-YenPqnAk/REPORT.md`, `restore.mjs`, `ready/`. 새 디렉터리로만 복원하며 원본 저장소나 보관 사본을 실험 대상으로 사용하지 않는다.
- 기존 `node_modules/.package-lock.json`은 스냅샷의 설치 lock 사본과 동일했다. 저장소의 선언/lock과 실제 설치 의존성은 별개이므로 `npm ci`만으로 같은 실습 환경이 재현된다고 가정하면 안 된다. 이번에는 install/generate/migration을 하지 않았다.
- 이 문서가 포함된 커밋을 새 복제본에서 checkout하면 코드 상태를 보존할 수 있다. 정확한 실습 환경 재현은 기존 `restore.mjs ready`의 의존성 검증·재사용 제약까지 따른다. 기존 루트를 reset/restore/clean하거나 자동 stash하지 않는다.
- 임시 사본은 OS 정리 대상이다. Git 커밋에는 소스와 기록만 포함하고 `.env`, 개인 키, 원시 테스트 로그, `node_modules`, 빌드 산출물은 포함하지 않는다.
- 명시한 파일에서 흔한 토큰·개인키·인증 URL 패턴은 발견되지 않았다. 제한된 패턴 검사이며 포괄적인 비밀정보 부재 보장은 아니다.
