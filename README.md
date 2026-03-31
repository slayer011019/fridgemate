# FridgeMate

FridgeMate is a local-first web app for managing fridge and pantry ingredients, tracking expiry dates, and recommending recipes based on what you already have at home.

Short GitHub description:
`Local-first fridge tracker with expiry alerts, recipe recommendations, and OCR-based ingredient import.`

## Demo Highlights

- Add, edit, delete, and mark ingredients as consumed
- Track purchase dates, expiry dates, and days remaining
- Filter by category and storage type
- Sort ingredients by expiry urgency
- Get recipe recommendations from local seed data
- See matched and missing ingredients clearly
- Import ingredients from shopping screenshots using browser-side OCR
- Persist data locally in IndexedDB with no backend required

## Tech Stack

- React
- Vite
- JavaScript
- Tailwind CSS
- IndexedDB
- Tesseract.js

## Pages

- `/` dashboard summary
- `/ingredients` ingredient list and filters
- `/ingredients/new` add ingredient form
- `/ingredients/:ingredientId/edit` edit ingredient form
- `/import` OCR-based screenshot import with review flow
- `/recipes` recipe recommendations and missing ingredient details

## Project Structure

```text
src/
  components/
  data/
  db/
  hooks/
  pages/
  utils/
scripts/
```

## Local Persistence

FridgeMate stores ingredient data in the browser using IndexedDB. Refreshing the page keeps the saved ingredients on the same browser and device.

Because this is a local-first MVP:

- there is no authentication
- there is no backend server
- data does not sync across devices

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
- `npm run build` creates the production build
- `npm run preview` previews the production build locally

## Portfolio Notes

This project is a strong beginner portfolio piece because it shows:

- CRUD flows and state management
- local persistence with IndexedDB
- filtering and sorting UX
- recommendation logic
- browser-side OCR and post-processing
- a practical single-user MVP scope

## Known Limitations

- No user accounts or cloud sync
- Recipe data is local seed data only
- OCR quality depends heavily on screenshot clarity and layout
- Import parsing is currently tuned for the existing shopping screenshot format

## Future Improvements

- Better OCR dictionaries and correction rules
- Ingredient aliases or fuzzy matching
- Recipe filters by category and cooking time
- Import history and correction learning
- Optional export and backup flow
