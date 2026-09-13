# 추천 정책 실습 보존 기록과 main의 구분

기록일: 2026-09-13 KST. 이 문서는 **별도 보존 커밋의 과거 검증 기록**이다. 현재 main의 테스트 실패나 버그 수정 완료를 보고하는 문서가 아니다.

보존 소스: [`6402c7b44da8bdc0ee98aa548a18c96965fba2af`](https://github.com/slayer011019/fridgemate/commit/6402c7b44da8bdc0ee98aa548a18c96965fba2af). 당시 브랜치 이름은 `codex/weekly-meal-plan`이지만, 재현 기준은 이동 가능한 브랜치명이 아닌 위 커밋이다.

## 왜 main에 그대로 병합하지 않는가

- 보존 작업 시작 HEAD는 `cbd6eb7`이었다. 루트에 남은 애드센스 코드·과거 점검 문서를 `f2b3468`, 추천 안내 개선·실습 테스트를 `6402c7b`에 보존했다. 이때 추천 구현과 테스트의 내용은 수정하지 않았다.
- 애드센스 코드 상당 부분은 이미 PR #42에서 최신 main에 통합됐다. 보존 브랜치의 상세 페이지·SEO 검증기·추천 구현은 후속 개선이 빠진 과거 사본이다. 전체 파일로 덮어쓰면 준비 체크리스트·스크립트 검사·선호도 점수·catalog adapter 재료 보존 등을 잃을 수 있다.
- 주간 식단은 [PR #48](https://github.com/slayer011019/fridgemate/pull/48)에서 최신 main에 맞춰 DB v3·기존 데이터 보존·계정 정리를 통합했다. 보존 브랜치의 DB v2나 좁은 계정 정리 구현으로 돌아가면 안 된다.
- 보존 브랜치를 main으로 보내던 [PR #49](https://github.com/slayer011019/fridgemate/pull/49)는 병합 충돌 상태였으며 2026-09-13 닫혔다. 실습 자료는 보존 커밋에 남기고, 이 문서만 main에 공유한다.
- 이 문서를 추가하는 PR에는 실습 구현·테스트를 가져오지 않는다. main의 구현, 정상 테스트, 설정, 의존성, 인증·DB 코드는 그대로 유지한다.

## 확정한 실습 정책과 출발점

기존 정규화 규칙에서 같은 이름이 핵심 재료와 필수 양념에 모두 있으면 추천 계산에서 핵심 재료로 한 번만 취급한다. 없을 때는 `missingCore`에만 표시하고 다른 필수 양념의 누락은 유지한다. `requiredSeasonings`와 대체 입력 `pantryIngredients`를 모두 검사한다.

보존 커밋의 구현은 이 정책을 아직 충족하지 않는다. 기존 테스트에 기록된 출력 동작을 이번 정책에서 변경하는 것이며, 이전 테스트를 공식적인 과거 제품 명세로 단정하지 않는다. 조리법 원본의 용도·분량이나 별칭·가중치·선택/액체/미분류 충돌 정책은 실습 범위를 확장하지 않는다.

다음 해시는 **main이 아닌 보존 커밋의 파일**을 가리킨다. 2026-09-13 보존 작업 당시 세 파일 모두 앞서 준비한 ready 스냅샷과 바이트 단위로 일치했다.

| 보존 커밋의 파일 | SHA-256 |
| --- | --- |
| `src/utils/recommendations.js` | `ba43711cce5a96dfe94c7eb20ff4cab49b423ba57454abd50ac50e2ddd3ecbf1` |
| `src/utils/__tests__/recommendations.test.js` | `9c0d8d04c6859c4ef7c55185bc91aa8043b23ebb4cd214b57b78f80c83d1bdab` |
| `src/utils/__tests__/recommendations.agent-regression.test.js` | `e7c2609e07c177d35be673be8946ee2578852c63f3a6fe840921119b63468de8` |

## 보존 작업 당시의 검증 결과

기존 설치 의존성을 교체하지 않고 Node 24.19.0 / Vitest 4.1.2 / Vite 8.2.2로 실행했다. 앞선 ready 검증의 Node 20과 런타임은 다르지만 정책 실패 결과는 동일했다. 아래 수치는 당시 보존 작업 트리의 결과이며 현재 main의 테스트 수나 새로운 환경에서 보장되는 결과가 아니다.

| 당시 검사 | 결과 |
| --- | --- |
| 기존 recommendations 파일 | 32개 중 31개 통과, 소금 `missingSeasonings` assertion 1개 예상 실패 |
| 새 agent-regression 파일 | 24개 중 정상 입력 8개 통과, 중복 사례 16개 예상 실패 |
| 실습 합계 | 56개 중 39개 통과·17개 실패, skip/todo 없음, 종료 코드 1 |
| 당시 루트 전체 테스트 | 92파일 중 90파일 통과·실습 2파일 실패. 519개 중 502개 통과·같은 17개 실패 |
| ESLint | 통과 |
| 빌드 및 SEO postbuild | 공개 경로 113개·사이트맵·noindex 앱 셸 검사 통과 |

실패는 점수·매칭 목록·부족 양념의 `AssertionError`였으며 import/환경 오류가 아니었다. 실행 대상에 `.worktrees/**` 결과가 섞이지 않았다. 전체 실행에서도 예상 밖 실패나 Prisma 오류는 나타나지 않았지만, 과거 Prisma 실패 원인이 확정되거나 해결됐다는 의미는 아니다. Prisma·인증·DB 코드는 수정하지 않았다.

당시 제한 환경의 빌드 소켓 권한 경고는 허용된 재실행으로 해소됐다. 오래된 Browserslist 데이터와 일부 React 테스트의 `act` 경고는 남았고 의존성은 갱신하지 않았다. 브라우저 E2E는 보존 작업에서 재실행하지 않았다. PR #48의 별도 통합 검증과 구분한다.

## 재현은 새 복제본에서만

1. 소스만 확인하려면 **비어 있는 새 복제본**에 위 보존 커밋을 checkout한다. 이 문서가 main에 추가된 커밋을 checkout하는 것은 실습 소스 복원이 아니다.
2. 원래 ready 실습을 재현하려면 아래 로컬 자료의 `REPORT.md`, `restore.mjs`와 의존성 제약을 먼저 확인한다. 복원기는 새 폴더만 만들며 검증한 기존 `node_modules`를 재사용한다. 원본 저장소나 보관 스냅샷 자체를 실행 대상으로 사용하지 않는다.
3. 필요한 로컬 자료가 없으면 동일 환경 재현을 중단한다. 파일을 임의로 재구성하거나 `npm ci`만으로 같은 환경이라고 주장하지 않는다. 자료를 확보하거나 새 기준 환경을 별도로 승인·검증해야 한다.
4. 원래 설치 lock 검증과 대상 파일 해시를 확인한 **복원된 실습 복제본 안에서만** 다음 명령을 사용한다. 원본 저장소에서 reset/clean/restore하거나 자동 stash하지 않는다.

```sh
npm run test:run -- src/utils/__tests__/recommendations.test.js src/utils/__tests__/recommendations.agent-regression.test.js --exclude '.worktrees/**'
```

이 명령의 39개 통과·17개 assertion 실패가 기록된 실습 출발점이다. 현재 main에는 해당 agent-regression 파일을 추가하지 않으므로 위 명령을 main의 검증 명령으로 사용하지 않는다. 일반 main 검증은 README의 `npm run test:run` 등을 따른다. 재현 결과가 다르면 자동으로 구현이나 기대값을 바꾸지 말고 원인을 확인한다.

## 당시 로컬 증거와 한계

다음은 당시 기기에 있던 경로이지 Git에 첨부된 다운로드 자료가 아니다. 다른 사용자나 CI에서는 없을 수 있고 임시 파일은 OS 정리 대상이다.

- 보존 작업 사본·JSON: `/private/tmp/fridgemate-root-changes-tdSWbs/`의 `before-commit-files.tar.gz`, `recommendations-tests.json`, `all-tests.json`.
- 이전 실습 스냅샷·복원기: `/private/tmp/fridgemate-agent-regression-YenPqnAk/`의 `REPORT.md`, `restore.mjs`, `ready/`, `installed-package-lock.json`.
- 당시 `node_modules/.package-lock.json`은 스냅샷의 설치 lock 사본과 같았다. 저장소 선언/lock과 실제 설치 의존성은 별개이며 소스 checkout만으로 이 설치 환경까지 복원되지는 않는다.

원본 보존 커밋에는 소스와 기록만 포함했다. `.env`, 개인 키, 원시 테스트 로그, `node_modules`, 빌드 산출물 및 디자인 스킬 파일은 포함하지 않았다. 당시 명시한 파일에서 흔한 비밀키 패턴은 발견되지 않았지만 제한된 패턴 검사를 포괄적인 비밀정보 부재 보장으로 해석하지 않는다.
