# AMS Frontend (Apartment Management System)

React + TypeScript + Vite web application for L&N Estate in Buea, Cameroon. Built per `docs/FRONTEND_BRIEF.md` following the "C Console, refined" design system.

---

## 1. Setup & Requirements

### Prerequisites
- **Node.js**: v18+ (tested on Node 20+)
- **Backend API**: Running at `http://localhost:8000` (FastAPI + SQLite)
  - To seed backend dev data: `cd backend && uv run python -m app.seed_dev --reset`
  - Default dev credentials: `dev@example.com` / `dev-password-123`

### Installation
```bash
cd frontend
npm install
```

---

## 2. Environment Variables

Create or inspect `.env` in the `frontend/` directory (see `.env.example`):

```bash
VITE_API_URL=http://localhost:8000
```

- `VITE_API_URL`: Base URL of the running FastAPI backend. Defaults to `http://localhost:8000` if omitted.

---

## 3. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server (defaults to `http://localhost:5173`) with Hot Module Replacement. |
| `npm run build` | Runs TypeScript type checking (`tsc`) and builds production bundles into `dist/`. |
| `npm run preview` | Starts local preview server for the compiled production build in `dist/`. |
| `npm test` | Runs Vitest unit test suite (formatters, calculations, utility functions). |
| `npm run gen:api` | Regenerates TypeScript schema types (`src/api/schema.d.ts`) from the backend OpenAPI JSON specification. |

---

## 4. How to Regenerate the API Client

Whenever the backend models or endpoints change:
1. Ensure the backend server is running:
   ```bash
   cd backend && uv run uvicorn app.main:app --reload
   ```
2. In the `frontend` directory, run:
   ```bash
   npm run gen:api
   ```
   This pulls the OpenAPI specification from `http://localhost:8000/openapi.json` and updates `src/api/schema.d.ts`.
3. Check for any TypeScript type errors in the frontend:
   ```bash
   npm run build
   ```

*Note: Never hand-write or invent API types. Always consume the generated types in `src/api/schema.d.ts` and `openapi-fetch`.*

---

## 5. Architectural & Design Rules

This frontend strictly enforces the core domain rules established in `AGENTS.md` and `docs/FRONTEND_BRIEF.md`:

1. **No Frontend Billing Arithmetic:**
   - All tenant balances, paid-through dates, days overdue, and payment statuses are computed strictly on the backend.
   - For previewing payments or tenant payment distribution, always call `POST /payments/preview`.
   - The only frontend arithmetic permitted is quick-fill multiplier chips (e.g. `1x`, `3x`, `6x` base rent) and deposit previews.
2. **Immutable Financial Records:**
   - Payments are never deleted. They can only be voided with a recorded reason (`POST /leases/{id}/payments/{pid}/void`).
3. **Currency Formatting:**
   - Currency is whole FCFA integers only (e.g. `113 000 FCFA` with thin non-breaking space `\u202F`). No floating-point amounts. Use the `<Money />` component or `formatMoney()` helper.
4. **Status Indicators:**
   - Status is never represented by color alone; a descriptive text badge (`PAID`, `OVERDUE`, `GRACE`, `EXPIRING`, `DRAFT`, `ENDED`, etc.) always accompanies the marker.
5. **Mobile & Responsive Viewports:**
   - Tested at 1366px (desktop console) and 390px (mobile viewport).
   - On small screens, the desktop sidebar transforms into a top app bar with a slide-out drawer.
   - Tables scroll within their own horizontal scroll containers (`overflow-x-auto`) to prevent horizontal window shaking.
   - All interactive touch targets are at least 44px on mobile (`min-h-[44px]`).
6. **Accessibility & Keyboard Navigation:**
   - All modal dialogs implement WAI-ARIA standards using `useDialogA11y`: focus trapping, automatic focus on open, restoration on close, and `Esc` key dismissal.
   - High-contrast visible focus rings (`focus:ring-2 focus:ring-primary`).
   - Every input and select control has an explicit `<label htmlFor="...">`.
   - Icon-only buttons have descriptive `aria-label` attributes.
7. **Authentication & Session Handling:**
   - JWT tokens are stored in `localStorage` under `ams_token`.
   - Any API call receiving a `401 Unauthorized` automatically purges the token, redirects to `/login`, and flashes an expiration message.

