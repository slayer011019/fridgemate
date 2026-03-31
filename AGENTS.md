# AGENTS.md

## Project overview
FridgeMate is a solo MVP web app for managing ingredients in a fridge/pantry and recommending recipes based on available ingredients.

## Goal
Build a simple, clean, beginner-friendly web app that solves a real problem for people living alone:
- track ingredients
- monitor expiry dates
- reduce waste
- recommend recipes based on owned ingredients

## Tech stack
- React
- Vite
- JavaScript
- Tailwind CSS
- IndexedDB

## Scope for v1
Implement only:
- ingredient CRUD
- expiry date tracking
- filtering and sorting
- recipe recommendation based on owned ingredients
- local persistence with IndexedDB

Do NOT add in v1:
- authentication
- Firebase
- backend server
- OCR
- barcode scanning
- image recognition
- real-time sync

## Future scope
Possible later phases may include:
- screenshot import with OCR
- review-and-confirm batch import flow
- barcode scanning
- shared fridge features

## Coding rules
- Use JavaScript, not TypeScript.
- Keep the architecture simple and easy for one developer to maintain.
- Prefer readable code over abstract patterns.
- Avoid unnecessary dependencies.
- Keep components reasonably small and focused.
- Add comments only where they help understanding.
- Keep the UI modern, clean, and responsive.
- Do not overengineer state management.

## Suggested structure
- src/pages
- src/components
- src/data
- src/db
- src/utils
- src/hooks

## Core pages
- HomePage
- IngredientsPage
- IngredientFormPage
- RecipesPage

## Ingredient model
Each ingredient should support:
- id
- name
- category
- storageType
- quantity
- purchaseDate
- expiryDate
- memo
- consumed

## Recipe recommendation rules
Use local seed recipe data.
Each recipe should include:
- id
- title
- category
- ingredients
- optionalIngredients
- cookingTime
- description

Recommendation logic should support:
- matched required ingredients ratio
- bonus when recipe uses ingredients expiring within 2 days
- bonus when recipe can be made immediately
- bonus when only 1 ingredient is missing
- clear missing ingredient display in UI

## UX expectations
- Show expiring soon ingredients clearly
- Show expired ingredients clearly
- Show D-day or days remaining
- Use cards, badges, empty states, and simple summaries
- Make the app good enough for a portfolio or class demo

## Workflow
1. Inspect the repository first.
2. Summarize what already exists.
3. Make a short implementation plan.
4. Implement in small logical steps.
5. Run the app after major changes.
6. Fix obvious errors before finishing.
7. Update README.md when features or structure change.

## Done means
- Ingredient create/edit/delete works
- Consumed state works
- Data persists after refresh
- Filtering and sorting work
- Expiry status is visible
- Recipe recommendations work
- Missing ingredients are shown clearly
- Project runs with:
  - npm install
  - npm run dev
  - npm run build

## Final response expectations
At the end of each task, report:
- files created/changed
- what was implemented
- how to run it
- known limitations
- recommended next steps

## OCR import rules for future phases
When implementing screenshot import in a later phase:
- Use a review-and-confirm flow.
- Never auto-register OCR output directly without user confirmation.
- Prefer modular OCR/parsing code so the OCR provider can be swapped later.
- If browser OCR setup becomes too heavy or unreliable, implement the full import flow with a mock OCR adapter first, then plug in real OCR afterward without changing the UI flow.
- Implement the parser as a readable rule-based system first.
- Favor false negatives over false positives when parsing OCR lines.
- Do not auto-register parsed items without a user review/edit step.