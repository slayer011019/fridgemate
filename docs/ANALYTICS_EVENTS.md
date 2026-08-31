# Analytics Event Spec

FridgeMate의 초기 사업 KPI를 제품 이벤트로 연결하기 위한 추적 명세.

기준 시점: 2026-04-17

## 목적

이 문서는 아래 질문에 답하기 위한 최소 이벤트 집합을 정의한다.
- 신규 사용자가 첫 세션에서 핵심 가치를 경험하는가?
- OCR 등록 흐름이 실제 저장까지 이어지는가?
- 사용자가 매주 다시 돌아오는가?
- 추천과 장보기 흐름이 행동으로 이어지는가?
- 유료화 및 제휴 실험을 위한 기초 퍼널이 준비되어 있는가?

## Event Design Principles

- 이벤트명은 `snake_case`를 사용한다.
- 이벤트는 가능한 한 사용자 행동 단위로 기록한다.
- 한 이벤트가 여러 KPI를 계산할 수 있도록 공통 속성을 유지한다.
- guest mode와 authenticated mode를 모두 추적하되, 식별 정책은 분리한다.
- 아직 외부 분석 도구가 없어도 로컬 로그, 서버 로그, 또는 추후 analytics adapter에 연결할 수 있도록 vendor-neutral 구조를 유지한다.

## Common Properties

모든 이벤트에 공통으로 붙일 기본 속성:

- `event_name`
- `occurred_at`
- `session_id`
- `user_mode`
  - `guest`
  - `authenticated`
- `user_id`
  - guest는 `null`
- `route`
- `device_type`
  - `mobile`
  - `desktop`
- `api_mode`
  - `local_only`
  - `backend_enabled`
- `network_state`
  - `online`
  - `offline`

추가 권장 속성:
- `app_version`
- `source`
  - 예: `manual`, `ocr`, `recommendation`, `shopping_panel`

## Core Events

### Session and activation

#### `session_started`

언제:
- 앱 첫 진입 시
- 새 브라우저 세션 시작 시

속성:
- `entry_route`
- `has_existing_local_data`
- `has_restored_session`

용도:
- activation 기준 세션 모수
- guest/authenticated 진입 비중 파악

#### `activation_completed`

언제:
- 첫 세션 내 사용자가 첫 핵심 가치 행동을 완료했을 때

완료 조건:
- 아래 중 하나를 만족
  - 첫 재료 저장 완료
  - OCR import 저장 완료
  - 기존 재료가 있는 상태에서 recommendation 화면을 열고 결과를 확인

속성:
- `activation_path`
  - `manual_first_ingredient`
  - `ocr_first_import`
  - `recommendation_view_with_existing_data`
- `minutes_from_session_start`

용도:
- activation rate 계산

### Ingredient lifecycle

#### `ingredient_created`

언제:
- 재료 생성 성공 시

속성:
- `creation_method`
  - `manual`
  - `ocr`
  - `guest_import`
- `category`
- `storage_type`
- `has_expiry_date`
- `has_purchase_date`
- `quantity_present`

용도:
- 첫 등록 성공률
- manual vs OCR 등록 비중

#### `ingredient_updated`

언제:
- 재료 수정 성공 시

속성:
- `fields_changed`
- `source`

용도:
- 재고 유지 관리 행동 파악

#### `ingredient_consumed`

언제:
- 재료를 consume 처리했을 때

속성:
- `days_to_expiry_bucket`
  - `expired`
  - `today`
  - `1_to_3`
  - `4_to_7`
  - `8_plus`
- `source`

용도:
- expiry intervention rate 계산

#### `ingredient_restored`

언제:
- consume 상태에서 복구했을 때

속성:
- `days_to_expiry_bucket`

용도:
- 오조작 및 복구 흐름 파악

### OCR funnel

#### `ocr_upload_started`

언제:
- 사용자가 이미지 파일을 업로드했을 때

속성:
- `file_type`
- `source_screen`

용도:
- OCR 퍼널 시작점

#### `ocr_parse_completed`

언제:
- OCR 인식과 파싱이 성공적으로 끝났을 때

속성:
- `raw_text_length`
- `parsed_item_count`
- `template_type`
- `confidence_bucket`
  - `low`
  - `medium`
  - `high`

용도:
- OCR 품질과 결과량 파악

#### `ocr_review_completed`

언제:
- 사용자가 review 단계에서 저장 직전까지 도달했을 때

속성:
- `parsed_item_count`
- `selected_item_count`
- `edited_item_count`
- `deleted_item_count`

용도:
- OCR review friction 파악

#### `ocr_import_saved`

언제:
- OCR review 이후 선택 항목 저장 성공 시

속성:
- `saved_item_count`
- `edited_before_save_count`
- `session_first_import`

용도:
- OCR completion rate 계산

### Recommendation funnel

#### `recommendations_viewed`

언제:
- 추천 화면 또는 홈 preview에서 추천 결과가 표시될 때

속성:
- `screen`
  - `home`
  - `recipes`
- `available_ingredient_count`
- `expiring_soon_count`
- `ready_count`
- `buy_one_more_count`
- `use_soon_count`

용도:
- recommendation exposure 측정

#### `recommendation_clicked`

언제:
- 사용자가 추천 카드 상세 행동을 눌렀을 때

속성:
- `screen`
- `group`
  - `ready`
  - `buy_one_more`
  - `use_soon`
- `score`
- `missing_core_count`

용도:
- recommendation CTR 계산

#### `recommendation_to_shopping_list`

언제:
- 추천 흐름에서 부족 재료를 shopping 의사결정으로 넘길 때

속성:
- `missing_item_count`

용도:
- 추천이 구매 행동으로 이어지는지 측정

### Shopping and affiliate readiness

#### `shopping_panel_viewed`

언제:
- shopping panel이 열린 상태로 사용자에게 노출될 때

속성:
- `item_count`

용도:
- shopping flow usage 파악

#### `shopping_item_added`

언제:
- shopping panel에 항목이 추가될 때

속성:
- `source`
  - `consumed_item`
  - `recommendation_gap`
  - `manual`

용도:
- 재구매 의도 파악

#### `affiliate_link_clicked`

언제:
- 외부 구매 링크를 클릭했을 때

속성:
- `placement`
  - `recommendation_card`
  - `shopping_panel`
- `partner`
- `item_count`

용도:
- affiliate CTR 계산

### Auth and monetization readiness

#### `signup_completed`

언제:
- 회원가입 성공 시

속성:
- `source_screen`

용도:
- account conversion 추적

#### `login_completed`

언제:
- 로그인 성공 시

속성:
- `restored_session`

용도:
- returning authenticated user 파악

#### `paywall_viewed`

언제:
- 향후 premium 기능 진입 시 paywall 노출

속성:
- `entry_point`
- `plan_context`

용도:
- premium funnel 상단 측정

#### `premium_upgrade_started`

언제:
- 결제 또는 업그레이드 시작 시

속성:
- `entry_point`
- `plan_interval`
  - `monthly`
  - `yearly`

용도:
- 유료 전환 실험 기초 데이터

#### `premium_upgrade_completed`

언제:
- 결제 완료 후 premium 상태가 확정됐을 때

속성:
- `plan_interval`
- `price_tier`

용도:
- premium conversion rate 계산

## KPI Formulas

### Activation rate

정의:
- `activation_completed` 고유 세션 수 / `session_started` 고유 세션 수

### OCR completion rate

정의:
- `ocr_import_saved` 고유 세션 수 / `ocr_upload_started` 고유 세션 수

### 7-day retention

정의:
- Day 0에 `session_started`가 있는 사용자 중 Day 7 이내 다시 `session_started`가 있는 사용자 비율

주의:
- guest는 브라우저 기반 익명 식별자 필요

### 30-day retention

정의:
- Day 0에 `session_started`가 있는 사용자 중 Day 30 이내 다시 `session_started`가 있는 사용자 비율

### Weekly active users

정의:
- 최근 7일 내 `session_started` 또는 핵심 행동 이벤트가 있는 고유 사용자 수

### Expiry intervention rate

정의:
- `days_to_expiry_bucket`이 `expired`, `today`, `1_to_3`, `4_to_7`인 재료 중 `ingredient_consumed`가 발생한 비율

### Recommendation click-through rate

정의:
- `recommendation_clicked` 수 / `recommendations_viewed` 수

### Premium conversion rate

정의:
- `premium_upgrade_completed` 고유 사용자 수 / `paywall_viewed` 고유 사용자 수

### Affiliate click-through rate

정의:
- `affiliate_link_clicked` 수 / affiliate link가 포함된 recommendation 또는 shopping panel 노출 수

## Identity and Storage Defaults

- guest 사용자는 브라우저 로컬에 저장된 익명 `analytics_id`로 식별한다.
- authenticated 사용자는 서버 `userId`를 우선 사용한다.
- 로그인 전후 연결이 필요하면 `analytics_id`와 `userId`를 alias 처리할 수 있게 설계한다.
- 초기 구현은 콘솔/메모리/서버 로그 어느 방식이든 가능하지만, 이벤트 shape은 이 문서를 기준으로 유지한다.
- 계정 연결 ProductEvent 원본은 서버 `createdAt` 기준 90일, RecommendationEvent 원본은 180일 보존하는 것을 운영 정책으로 한다. 계정 삭제는 이 기간보다 우선해 즉시 연결 행을 삭제한다.
- 현재 인증 전용 수집 경로에서 생성되지 않는 `RecommendationEvent.userId IS NULL` legacy 행은 bounded retention 작업으로 제거한다. 스키마의 nullable 제약은 실제 데이터 검증 전까지 유지한다.
- `npm run events:prune-retention`은 삭제 없는 미리보기이며, 실제 삭제에는 `--apply`와 정확한 `--confirm-database-host`가 모두 필요하다. 배포 API 자격 증명이 아닌 forced tenant RLS를 우회할 수 있는 trusted maintenance 연결에서만 실행한다.
- 현재 구현은 수동 운영 명령까지이며 반복 scheduler는 아직 없다. 따라서 실제 90일/180일 집행은 승인된 수동 실행에 의존하고, 수집을 운영 활성화하기 전 별도로 최소권한 scheduler를 검토해야 한다.
- 추천 학습 export는 기본 최근 180일이며 `--since`/`--until`을 지정해도 180일을 넘길 수 없다. 내보낸 파일은 원본 DB TTL과 별개이므로 목적 달성 후 운영자가 삭제한다.

## Recommended First Implementation Slice

1차 구현 우선 이벤트:
- `session_started`
- `activation_completed`
- `ingredient_created`
- `ingredient_consumed`
- `ocr_upload_started`
- `ocr_import_saved`
- `recommendations_viewed`
- `recommendation_clicked`
- `signup_completed`
- `login_completed`

이 범위면 아래 KPI를 우선 계산할 수 있다:
- activation rate
- OCR completion rate
- 7-day / 30-day retention
- weekly active users
- expiry intervention rate
- recommendation CTR

## Near-Term Repo Follow-Ups

- GA4 adapter는 기존 `trackEvent(name, properties)` 인터페이스 뒤에서 동작하며 `VITE_GA_MEASUREMENT_ID`가 유효하고 이용자가 분석을 허용한 경우에만 외부 이벤트를 전송한다.
- GA4 전송 시 `user_id`, `analytics_id`, `session_id`, 이메일, 객체형 자유 입력은 제거한다.
- SPA 경로 변경은 `page_view`로 기록하고 `activation_completed`, `signup_completed`는 GA4 속성에서 주요 이벤트로 지정한다.
- route/page 단위 추적 지점 명세
- guest anonymous id 저장 방식 확정
- recommendation card CTA 구조와 click event 매핑
- paywall 도입 전 premium event placeholder 추가 여부 검토
