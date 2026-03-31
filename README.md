# FridgeMate

FridgeMate는 식재료를 등록·관리하고 유통기한을 추적하며,
보유 재료를 기반으로 레시피를 추천해주는 웹앱입니다.
주문내역 캡처를 활용한 반자동 식재료 등록 기능도 함께 실험하고 있습니다.

Short GitHub description:
`Local-first fridge tracker with expiry alerts, recipe recommendations, and OCR-based ingredient import.`

## Overview

자취를 하다 보면 냉장고 안에 어떤 재료가 있는지 잊어버리거나,
유통기한이 지나서 버리게 되는 경우가 많습니다.
또 남은 재료로 뭘 해먹을지 바로 떠오르지 않아서 음식물 낭비가 생기기도 합니다.

FridgeMate는 이런 문제를 해결하기 위해 시작한 프로젝트입니다.
단순한 식재료 메모장이 아니라,

- 재료를 쉽게 등록하고
- 유통기한을 관리하고
- 지금 가진 재료로 만들 수 있는 요리를 추천하고
- 주문내역 캡처를 통해 입력 부담까지 줄이는 것

을 목표로 하고 있습니다.

## Main Features

### Ingredient Management

- 식재료 등록 / 수정 / 삭제
- 소비 완료 처리
- 냉장 / 냉동 / 실온 분류
- 카테고리별 필터링

### Expiry Tracking

- 유통기한 저장
- D-day 및 남은 날짜 표시
- 임박 재료 / 만료 재료 상태 구분

### Recipe Recommendation

- 현재 보유 재료 기준 레시피 추천
- 지금 만들 수 있는 요리 표시
- 1개만 더 사면 되는 요리 구분
- 부족한 재료 표시

### Grocery Import (Experimental)

- 쇼핑몰 주문내역 캡처 이미지 업로드
- OCR 기반 상품 후보 추출
- 사용자 검토 후 일괄 등록
- 완전 자동 등록이 아닌 review-and-confirm 방식

## Why This Project

기존의 냉장고 관리 앱은 직접 입력해야 하는 번거로움이 크고,
레시피 추천과 재료 관리가 자연스럽게 이어지지 않는 경우가 많다고 느꼈습니다.

FridgeMate는

- 입력 부담을 줄이는 import 기능
- 재료 정규화
- 유통기한 기반 추천 우선순위

를 함께 고려해, 실제 생활에서 더 자주 쓸 수 있는 구조를 목표로 했습니다.

## Tech Stack

- React
- Vite
- Tailwind CSS
- JavaScript
- IndexedDB
- Tesseract.js
- Express
- Prisma
- PostgreSQL

## Pages

- `/` dashboard summary
- `/ingredients` ingredient list and filters
- `/ingredients/new` add ingredient form
- `/ingredients/:ingredientId/edit` edit ingredient form
- `/import` OCR-based screenshot import with review flow
- `/recipes` recipe recommendations and missing ingredient details

## Project Structure

```bash
src/
  components/
  data/
  db/
  hooks/
  pages/
  utils/
scripts/
server/
prisma/
```

## Local Persistence

FridgeMate stores ingredient data in the browser using IndexedDB. Refreshing the page keeps the saved ingredients on the same browser and device.

By default, the current MVP still works as a local-first app:

- there is no authentication
- a backend is optional unless `VITE_API_BASE_URL` is configured
- data does not sync across devices

## Backend Expansion Path

This project now includes a starter backend structure for moving beyond the local-only MVP:

- `server/` contains an Express API skeleton
- `prisma/schema.prisma` defines the initial `Ingredient` database model
- `.env.example` documents the required environment variables
- the frontend can use the API when `VITE_API_BASE_URL` is set
- if `VITE_API_BASE_URL` is not set, the app keeps using IndexedDB as a fallback

### Planned API Endpoints

- `GET /api/health`
- `GET /api/ingredients`
- `GET /api/ingredients/:id`
- `POST /api/ingredients`
- `POST /api/ingredients/bulk`
- `PATCH /api/ingredients/:id`
- `DELETE /api/ingredients/:id`
- `GET /api/recipes/recommendations`

## OCR Import Flow

- Upload a shopping app screenshot or receipt image
- Run OCR in the browser with `tesseract.js`
- Parse extracted text with the rule-based import pipeline in `src/utils/import/`
- Review, edit, and select the detected items
- Import only the confirmed items into IndexedDB

## Recipe Recommendation Logic

- Base score uses matched required ingredients ratio
- Bonus when a recipe uses ingredients expiring within 2 days
- Bonus when the recipe can be made immediately
- Bonus when only 1 ingredient is missing
- Missing ingredients are shown in the UI

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer

### Install

```bash
npm install
```

### Run the App

```bash
npm run dev
```

### Run the API Server

```bash
npm run dev:server
```

## Local PostgreSQL Setup

This machine does not currently have `psql` or Docker installed, so you will need a PostgreSQL server before the API can run end-to-end.

### Option 1: Install PostgreSQL locally

1. Install PostgreSQL on your machine
2. Create a database named `fridgemate`
3. Update `.env` with your local database username and password
4. Run:

```bash
npm run prisma:migrate
npm run dev:server
```

Example `.env` value:

```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/fridgemate?schema=public"
```

### Option 2: Use a hosted PostgreSQL database

If you do not want to install PostgreSQL locally, you can use a hosted database from services like Supabase, Neon, or Railway and paste that connection string into `.env`.

### Build for Production

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

## Scripts

- `npm run dev` starts the Vite development server
- `npm run dev:server` starts the Express API server with `.env`
- `npm run build` creates the production build
- `npm run preview` previews the production build locally
- `npm run prisma:generate` generates the Prisma client
- `npm run prisma:migrate` runs a local Prisma migration

## Portfolio Notes

This project is a strong beginner portfolio piece because it shows:

- CRUD flows and state management
- local persistence with IndexedDB
- filtering and sorting UX
- recommendation logic
- browser-side OCR and post-processing
- a practical single-user MVP scope

## Known Limitations

- No user accounts or authorization yet
- Recipe data is local seed data only
- OCR quality depends heavily on screenshot clarity and layout
- Import parsing is currently tuned for the existing shopping screenshot format
- Backend files are scaffolded, but a real PostgreSQL database must be configured before the API can run end-to-end

## Future Improvements

- Better OCR dictionaries and correction rules
- Ingredient aliases or fuzzy matching
- Recipe filters by category and cooking time
- Import history and correction learning
- Optional export and backup flow
