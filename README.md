# FridgeMate

FridgeMate is a local-first web app for managing fridge and pantry ingredients, tracking expiry dates, and recommending recipes based on what the user already has.

This project started as a frontend MVP focused on everyday single-user use cases, and was later extended with an Express + Prisma + PostgreSQL backend path while keeping IndexedDB fallback for local-first usage.

Live Demo: `https://fridgemate-ten.vercel.app/`

Short GitHub Description:
`Local-first fridge tracker with expiry alerts, recipe recommendations, and OCR-based ingredient import.`

## Overview

People living alone often forget what ingredients they already have, miss expiry dates, or struggle to decide what to cook with leftover items.

FridgeMate was built to make that flow simpler:

- register and organize ingredients
- see expiring or expired items clearly
- get recipe suggestions from owned ingredients
- reduce input friction with OCR-based screenshot import

## What Is Implemented

### Frontend MVP

- ingredient CRUD
- consumed state toggle
- optimistic ingredient updates for faster add/edit/delete feedback
- lightweight “buy again” shopping-list style section for consumed items
- consumed items are separated into a dedicated shopping-list panel by default
- quick quantity and memo editing with auto-save inside the buy-again section
- bulk restore action for buy-again items
- filtering and sorting
- expiry date tracking with D-day style display
- recipe recommendations based on current ingredients
- pantry staple ownership toggle for common seasonings and sauces
- local persistence with IndexedDB

### OCR Import Flow

- image upload for shopping/order screenshots
- browser-side OCR with `tesseract.js`
- rule-based parsing and normalization
- review-and-confirm import flow
- learned correction history for repeated import edits

### Backend Path

- Express API structure
- Prisma schema for ingredients
- PostgreSQL-ready server configuration
- ingredient CRUD API
- recipe recommendation API
- frontend API integration with IndexedDB fallback

## What Is Not Fully Finished Yet

- authentication or multi-user support
- shared fridge or sync across devices
- production database deployment and persistent hosted backend verification
- AI-based recommendation engine
- generalized OCR support for many shopping layouts

## Tech Stack

### Frontend

- React
- Vite
- JavaScript
- Tailwind CSS

### Storage and Data

- IndexedDB
- PostgreSQL
- Prisma

### Backend

- Express
- Node.js

### Experimental Import

- Tesseract.js
- rule-based parsing and normalization

## Key Features

### 1. Ingredient Management

- add, edit, and delete ingredients
- mark ingredients as consumed
- organize by category and storage type
- sort by expiry date

### 2. Expiry Tracking

- display expiry dates clearly
- highlight expiring soon ingredients
- separate expired items from active items

### 3. Recipe Recommendation

- calculate recommendation score from owned ingredients
- separate fridge ingredients, pantry staples, and shopping intent conceptually
- distinguish:
  - recipes that can be cooked now
  - recipes that need only one more ingredient
  - other partially matched recipes
- show missing ingredients explicitly
- treat pantry staples as lightweight penalties instead of hard blockers

### 4. OCR-Based Import

- upload screenshot image
- extract text in the browser
- normalize noisy product names into simpler ingredient names
- keep review before final save

## Architecture Notes

FridgeMate is intentionally designed as a gradual system instead of a full backend-first application.

### Current Data Strategy

- default philosophy: local-first
- frontend can run without backend
- IndexedDB remains the safety net
- ingredient state is shared through one client-side store so pages reuse the same loaded data
- pantry staple ownership state is also shared globally so recipe pages stay in sync immediately

### API Connection Strategy

- if `VITE_API_BASE_URL` is set, the frontend tries the backend API first
- if the API is unavailable or returns a server-side failure, ingredient data falls back to IndexedDB
- recipe recommendations can also use the backend API, but keep local recommendation logic as fallback

This was a deliberate decision to avoid breaking the original MVP while expanding the project toward a more service-like architecture.

## Technical Decisions

### Why local-first first?

This project started as a student-friendly MVP. Using IndexedDB made it possible to finish a usable product quickly without waiting on backend infrastructure.

### Why keep IndexedDB fallback even after adding backend support?

Because the original strength of the project was that it worked immediately in the browser. Removing that would have made the project more fragile during the transition to API-based storage.

### Why use rule-based OCR parsing instead of AI from the start?

The first goal was reliability, readability, and controllable false positives. A rule-based system was easier to debug and better aligned with a portfolio-scale MVP.

### Why Express + Prisma + PostgreSQL?

This stack keeps the backend simple enough for a solo developer while still showing practical backend skills:

- REST API design
- schema modeling
- validation
- migration flow
- environment-based deployment setup

## Project Structure

```bash
src/
  api/
  components/
  data/
  db/
  hooks/
  pages/
  utils/
server/
  src/
    db/
    lib/
    routes/
prisma/
scripts/
```

## Run Locally

### 1. Install

```bash
npm install
```

### 2. Create `.env`

macOS / Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Example `.env`

Frontend-only mode:

```bash
VITE_API_BASE_URL=
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/fridgemate?schema=public"
```

Frontend + backend mode:

```bash
VITE_API_BASE_URL=http://localhost:4000/api
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/fridgemate?schema=public"
```

### 4. Prisma Setup

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
```

### 5. Run the Backend

```bash
npm run dev:server
```

### 6. Run the Frontend

```bash
npm run dev
```

### 7. Verify

- frontend: `http://localhost:5173`
- health check: `http://localhost:4000/api/health`

## Backend Deployment

Recommended backend platforms:

- Render
- Railway

Recommended production environment variables:

```bash
PORT=10000
CLIENT_ORIGIN=https://YOUR-FRONTEND.vercel.app
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/fridgemate?schema=public
```

Frontend Vercel environment variable:

```bash
VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN/api
```

Prisma production note:

- use `npm run prisma:generate` during build
- use `npm run prisma:deploy` in deploy environments
- do not use `npm run prisma:migrate` as a production deploy command

## What I Learned

- how to build a usable MVP first before expanding architecture
- how to preserve an existing frontend while adding backend integration
- how to design fallback behavior instead of hard-switching data sources
- how to structure rule-based OCR parsing for a real UI workflow
- how to introduce Prisma and PostgreSQL incrementally without rewriting the whole app

## Portfolio Talking Points

- Built a local-first ingredient management app with IndexedDB persistence, expiry tracking, and recipe recommendation logic.
- Designed a rule-based OCR import flow with review-and-confirm UX instead of unsafe auto-registration.
- Extended a frontend MVP into an Express + Prisma + PostgreSQL architecture without removing the original fallback path.
- Implemented API-first ingredient CRUD with IndexedDB fallback for safer gradual migration.
- Organized recommendation logic so it can run locally today and move toward backend or AI-based recommendation later.

## Resume Bullet Examples

- Built a local-first fridge management web app using React, Vite, Tailwind CSS, and IndexedDB to manage ingredients, expiry dates, and recipe suggestions.
- Implemented a rule-based OCR import workflow with browser-side text extraction, product normalization, and review-before-save UX.
- Added an Express + Prisma + PostgreSQL backend path for ingredient CRUD and recommendation APIs while preserving IndexedDB fallback.
- Designed fallback-first frontend data flow so the app continues working locally even when backend APIs are unavailable.
- Documented local development, database setup, and deployment flow for Vercel frontend and separately deployed backend services.

## Future Improvements

The following are planned improvements, not fully implemented features yet:

- hosted PostgreSQL deployment and production verification
- unified recommendation source across dashboard and recipe pages
- better OCR dictionaries and normalization rules
- import history and correction management UI
- user accounts and multi-device sync
- AI-assisted recommendation or personalized meal planning

## License

No license has been added yet. If this project is going to stay public as a portfolio repository, adding an MIT license would be a reasonable next step.
