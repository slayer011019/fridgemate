# Business Roadmap

FridgeMate의 제품 방향, 수익 구조, 핵심 지표, 그리고 엑싯 옵션을 한 문서에서 관리하기 위한 사업 전략 메모.

기준 시점: 2026-04-17

## 1. Product Thesis

FridgeMate는 단순한 냉장고 기록 앱이 아니라, 가정 내 식재료 낭비를 줄이고 장보기 판단을 돕는 로컬 퍼스트 식재 관리 도구를 목표로 한다.

핵심 약속:
- 식재료를 덜 버리게 만든다.
- 지금 있는 재료로 더 빨리 결정하게 만든다.
- 구매와 소비 히스토리를 바탕으로 다음 행동을 제안한다.

현재 강점:
- 로컬 퍼스트 + IndexedDB fallback
- OCR 기반 빠른 등록 흐름
- 만료일 기반 우선 소비 경험
- pantry-aware recipe recommendation
- guest mode와 authenticated mode의 분리

## 2. Initial Customer

초기 타깃 고객:
- 1~2인 가구
- 장보기 앱, 배달앱, 마트 앱 사용 빈도가 높은 사용자
- 식비 절약이나 음식물 쓰레기 감소에 관심이 있는 사용자
- 식단 앱처럼 무거운 기록 습관은 부담스러워하는 사용자

피해야 할 초기 포지셔닝:
- 기업용 재고 관리
- 복잡한 식단/영양 추적 앱
- 대가족용 협업 도구를 첫 제품 메시지로 내세우는 전략

## 3. Monetization Model

### Primary: consumer subscription

무료 플랜:
- local-only ingredient tracking
- 기본 expiry tracking
- 기본 recommendation groups
- 제한적인 OCR import

유료 플랜 후보:
- 계정 기반 cloud sync
- multi-device restore
- 무제한 OCR import
- 소비/폐기/절약 리포트
- 더 정교한 recommendation insights
- household sharing

유료화 메시지:
- "기록 앱"이 아니라 "식비 절약과 낭비 감소를 보여주는 도구"

### Secondary: affiliate / commerce

제휴 가능 지점:
- `Buy one more` recommendation
- shopping panel의 재구매 흐름
- recipe recommendation에서 부족 재료 외부 링크 연결

초기 구현 원칙:
- 직접 결제 연동보다 outbound link tracking부터 시작
- 추천 품질과 클릭 유도를 먼저 검증

### Tertiary: B2B expansion option

중장기 확장 후보:
- 리테일/그로서리 제휴
- 식품 브랜드 캠페인
- 스마트홈/주방가전 연동

이 단계는 초기 주력 모델이 아니라, 추후 전략적 제휴나 인수 가능성을 높이는 옵션으로 취급한다.

## 4. 12-Month Execution Priorities

### Phase 1: retention-worthy core loop

목표:
- 신규 사용자가 첫 방문 당일 핵심 가치를 체감하도록 만든다.

우선순위:
- 첫 3개 품목 등록까지의 시간을 줄인다.
- OCR 결과 검토 후 저장 흐름을 더 빠르게 만든다.
- 홈 화면에 "먼저 먹을 것", "곧 버릴 가능성", "다시 사야 할 것"을 명확히 노출한다.
- 만료/소진 행동을 유도하는 CTA를 강화한다.

출시 기준:
- 사용자가 첫날 재료 등록, 추천 확인, 소진 판단까지 한 번에 경험할 수 있어야 한다.

### Phase 2: retention proof

목표:
- 사용자가 매주 다시 돌아올 이유를 만든다.

우선순위:
- 주간 리포트
- 만료/소진 리마인더
- 로그인 사용자 대상 간단한 usage insight
- household sharing 또는 동거인 공유 검토

출시 기준:
- "입력만 하고 끝나는 앱"이 아니라 "다시 켜게 되는 앱"이라는 증거를 만든다.

### Phase 3: monetization experiments

목표:
- 사용자가 어떤 가치에 지불하는지 확인한다.

우선순위:
- 무료/유료 경계 명확화
- sync + history + insights 묶음 실험
- outbound commerce link click-through 측정
- paid conversion funnel 수집

출시 기준:
- 지불 의사가 있는 사용자군과 그렇지 않은 사용자군을 구분할 수 있어야 한다.

## 5. Metrics That Matter

핵심 KPI:
- activation: 첫 세션 내 첫 재료 등록 완료율
- OCR completion rate: OCR 업로드 후 저장 완료율
- 7-day retention
- 30-day retention
- weekly active users
- expiry intervention rate: 만료 예정 품목이 소비/정리 처리된 비율
- recommendation click-through rate
- premium conversion rate
- affiliate click-through rate

해석 원칙:
- 단순 가입 수보다 반복 사용과 행동 유도 지표를 우선한다.
- 유료 전환이 낮을 때는 가격보다 문제 강도와 반복 사용성을 먼저 점검한다.

## 6. Exit Options

가장 현실적인 엑싯 경로:

### 1. Micro SaaS acquisition

전제:
- 작지만 안정적인 구독 매출
- 낮은 churn
- 명확한 사용자 루프

### 2. Strategic acquisition by commerce / grocery player

전제:
- 재구매 신호
- 장보기 의사결정 데이터
- 식재료 소비 패턴 인사이트

### 3. Smart kitchen / home platform acquisition

전제:
- household usage
- device or appliance integration potential
- pantry/fridge state as a recurring data surface

당장 필요한 것은 "엑싯 스토리"보다 아래 자산이다:
- 반복 사용 데이터
- 소비/재구매 의사결정 신호
- household 단위 락인 가능성

## 7. Product Decisions To Favor

앞으로 우선할 결정:
- 기능 수보다 핵심 루프 완성도를 높인다.
- OCR, expiry, recommendation, shopping을 하나의 사용자 흐름으로 묶는다.
- guest mode는 유지하되, paid value는 account/sync/report/share에 집중한다.
- B2B 기능은 초기 범위에 넣지 않는다.
- 대규모 AI 기능보다 실용적인 suggestion 품질과 정확한 fallback 경험을 우선한다.

## 8. Near-Term Repo Follow-Ups

사업 계획을 제품에 반영하기 위한 다음 작업 후보:
- onboarding success metric 정의 및 이벤트 추적 설계
- premium paywall 후보 기능 명세 작성
- household sharing 요구사항 초안 작성
- weekly insight / expiry reminder UX 초안 작성
- affiliate link slot을 고려한 recommendation card 정보 구조 검토
