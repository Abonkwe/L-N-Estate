# AMS (Apartment Management System)

Rent-management web app for a small landlord in Buea, Cameroon. Monorepo:
- backend/   FastAPI + SQLAlchemy + SQLite, managed with uv. Built and tested. Do not change it unless I ask.
- frontend/  React + TypeScript + Vite + Tailwind. This is what you build.
- docs/FRONTEND_BRIEF.md   Source of truth for the frontend.

## Before any frontend work
Read @docs/FRONTEND_BRIEF.md fully. Follow its build order, one screen per task.
Match the "C Console, refined" design and the tokens in section 5 exactly.

## Hard rules
1. Never calculate billing in the frontend. Use the API's fields as returned
   (payment_status, paid_through, days_overdue...). For "what will this payment do",
   call POST /payments/preview.
2. Payments are never deleted, only voided with a reason. No delete button for money.
3. Money is whole FCFA integers, shown like "113 000 FCFA". No floats.
4. Status is never colour alone: always a text label next to the marker.
5. Confirm before anything that changes money (payment preview, void reason, end lease).
6. Never invent API fields or hand-write API types. Use the generated client.
   If the API lacks something, tell me and propose a backend change.

## Commands
- Backend: cd backend && uv run uvicorn app.main:app --reload   (API http://localhost:8000, docs at /docs)
- Backend tests: cd backend && uv run pytest
- Dev data: cd backend && uv run python -m app.seed_dev --reset   (login dev@example.com / dev-password-123)
- Frontend: cd frontend && npm run dev   (http://localhost:5173)
- Frontend checks: npm run build and a type check must pass before you call a screen done.
- Regenerate the API client after any backend change (script name: npm run gen:api).

## How to work
- Show a short plan first and wait for my approval.
- One screen per task. Do not start the next one.
- Do not add dependencies without asking. Do not change the design tokens.
- Check the result at 1366px and 390px wide, and show me a screenshot.
- Do not commit; I will review and commit myself.