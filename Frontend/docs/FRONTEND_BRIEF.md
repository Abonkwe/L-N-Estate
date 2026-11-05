# AMS Frontend Brief

L&N Apartment Management System | November 4, 2026 | Author: Abonkwe | Status: v1, design direction "C Console" approved

## 0. How to use this brief

Give this document to the AI coding tool at the start of every session. Build **one screen at a time**, in the order in section 7. If something here conflicts with a request, ask before deviating. Visual reference: the design canvas, frame "C Console, refined" (https://claude.ai/artifact/TzLbJj8tPGQeU45moF289F). Copy the look from that frame exactly, then use the tokens in section 5.

## 1. Product in brief

A rent-management web app for a small landlord in Buea, Cameroon: 3 houses, about a dozen units. It replaces paper receipts, a Word rent sheet per tenant, and Excel. The landlord is not technical, so every common task must take only a few clicks.

- **Users:** three logins, all with identical access. Tenants never log in.
- **Main devices:** a Windows laptop browser (primary), an Android phone browser (secondary, must be usable).
- **Language:** English only. **Currency:** FCFA, whole numbers only.
- **MVP is online-only.** No offline support yet.

## 2. Stack and structure

- Vite + React + TypeScript (strict), Tailwind CSS, shadcn/ui components restyled to the tokens in section 5, TanStack Query, React Router, React Hook Form + Zod.
- API client generated from the backend schema: `openapi-typescript` + `openapi-fetch` against `http://localhost:8000/openapi.json`. Regenerate whenever the backend changes. Never hand-write API types.
- Auth: `POST /auth/login` (form fields `username` = email, `password`) returns a bearer token. Keep it in memory plus localStorage, send it as `Authorization: Bearer`, and on any 401 clear it and go to `/login`.
- Env: `VITE_API_URL=http://localhost:8000`. The backend already allows CORS from `http://localhost:5173`.

Suggested structure:

```
src/
  api/        generated types, client, query hooks (one file per area)
  components/ ui/ (restyled shadcn), layout/ (Sidebar, PageHeader), shared/ (StatusMarker, Money, DataTable, SummaryStrip)
  lib/        format.ts (money, dates), cn.ts
  pages/      Overview, Tenants, LeaseDetail, NewLease, Houses, Payments, Expenses, Reports, Login
  styles/     tokens.css (the tokens below), index.css
```

## 3. Rules that must never be broken

1. **The frontend never calculates billing.** Paid-through dates, balances, covered periods, overdue status and the deposit all come from the API. Use `payment_status`, `paid_through`, `days_overdue`, `next_month_charge` and so on exactly as returned. For "what will this payment do", call `POST /payments/preview`.
2. **A payment is never deleted, only voided** with a reason (`POST /payments/{id}/void`). There is no delete button anywhere for money.
3. **Money is whole FCFA integers.** Never use floats or decimals. Show as `113 000 FCFA` (thin spaces as thousands separators). In tables the unit sits in the column header, not in every cell.
4. **Status is never colour alone.** Every status shows a text label ("Overdue, 60 days") next to its marker.
5. **Confirm before anything that changes money:** recording a payment shows the preview first; voiding asks for a reason; ending a lease asks for confirmation.
6. **Dates:** display as `31 Aug 2026`; send and receive ISO `YYYY-MM-DD`. Use the API's "today" logic (the server decides overdue), never `new Date()` to decide status.

## 4. Backend contract (summary)

All routes except login need the bearer token. Full detail is in the generated client.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `GET /auth/me` |
| Overview | `GET /dashboard?expiring_days=30` returns `counts`, `leases[]` (sorted worst first), `vacant_units[]` |
| Houses, units | `/houses`, `/units` (`?house_id=`, `?vacant=true`), POST and PATCH |
| Tenants | `/tenants` (`?q=` searches name or phone), POST and PATCH |
| Leases | `POST /leases`, `GET /leases/{id}`, `POST /leases/{id}/terms` (rent change), `POST /leases/{id}/end`, `GET /leases/{id}/rent-sheet` |
| Payments | `POST /payments/preview`, `POST /payments`, `GET /payments`, `POST /payments/{id}/void`, `GET /payments/{id}/receipt.pdf`, `POST /adjustments` |
| Expenses | `/expenses` (filter by house, category, dates), POST and PATCH |
| Reports | `GET /reports/monthly?year=&month=` |

Key values:

- `payment_status` is one of `up_to_date`, `expiring_soon`, `grace`, `overdue`, `ended`.
- Payment `method` is `cash`, `bank` or `mobile_money`. Expense `category` is `repairs`, `installation`, `maintenance`, `water_bill`, `tax` or `other`.
- Lease creation: the deposit is computed by the server as exactly 2 x base rent. Show it, never let the user type it.
- The receipt PDF needs the auth header, so fetch it as a blob and open it in a new tab or print dialog, rather than linking to it directly.
- Errors come back as `{ "detail": "..." }`. Show that text to the user. 409 means a conflict (for example the unit already has an active lease), and 422 means a validation problem.

## 5. Design system: "C Console"

### Principles

1. **Table first.** Dense data goes in ruled tables, not grids of cards.
2. **Blue is the identity, red ink is the warning.** Red appears only for overdue. Everything else stays calm.
3. **Figures are a different voice.** All amounts, counts and dates in numeric columns use the mono face with tabular numerals, right-aligned.
4. **Urgency first.** Group and sort by what needs action: needs attention, coming up, up to date.
5. **One obvious next action.** Overdue rows get a filled blue button, other rows an outlined one.
6. **No decoration.** No gradients, no glass, no shadows except popovers and dialogs, no icons in coloured circles, no emoji.

### Tokens (put these in `styles/tokens.css` and the Tailwind theme)

| Token | Value | Use |
| --- | --- | --- |
| `--sidebar` | `#0F2540` | Sidebar background |
| `--sidebar-hover` / `--sidebar-active` | `#17335A` / `#1B3A63` | Sidebar item states |
| `--sidebar-text` / `--sidebar-label` | `#BFD0E6` / `#8FA6C6` | Sidebar text, section labels |
| `--bg` | `#E6ECF4` | App background |
| `--surface` | `#FFFFFF` | Tables, inputs, dialogs |
| `--line` | `#C4CFDF` | Panel borders, summary strip dividers |
| `--row-line` | `#DCE3EE` | Table row dividers |
| `--band` | `#EDF1F7` | Group header rows in tables |
| `--input-border` | `#B3C0D4` | Input borders |
| `--ink` | `#14213A` | Primary text, heavy header rule |
| `--ink-2` | `#4F5C74` | Secondary text, table headers |
| `--primary` / `--primary-hover` | `#1F5FD6` / `#174BB0` | Main actions, links |
| `--overdue` | `#A4281F` | Overdue text and marker |
| `--grace` | text `#7A5200`, marker `#D9971B` | Grace period |
| `--expiring` | text `#1F4E9E`, marker `#1F5FD6` | Expiring soon |
| `--paid` | `#2F6B4A` | Paid up |

Type: **Hanken Grotesk** (400, 500, 600, 700) for the interface and **IBM Plex Mono** (400, 500) for figures, both from Google Fonts. Page title 28px/600. Table body 14.5px. Table header 11px, uppercase, 0.08em tracking, 600. Summary numerals 30px mono 500.

Shape and spacing: 4px base grid (8, 12, 16, 24, 32). Table panel radius 6px, inputs 8px, primary button 8px, small buttons 6px. Page padding 30px top and bottom, 40px sides. Sidebar 236px wide.

### Components to build once and reuse

- **Sidebar:** product name and subtitle, a "Manage" group (Overview, Tenants, Payments, Expenses, Reports) and a "Houses" group listing each house with `occupied of total` in mono.
- **SummaryStrip:** a row between a heavy top rule and a hairline bottom rule, with a large monthly figure first and counts after, separated by vertical hairlines.
- **DataTable:** heavy rule under the header, hairline row dividers, optional group-header rows on the `--band` colour, numeric columns right-aligned in mono, horizontally scrollable on narrow screens.
- **StatusMarker:** a 9px rounded square plus the text label in the status colour, never a pill.
- **Buttons:** primary (solid blue), filled-small (urgent row action), outlined-small (other row actions). Real `<button>` elements with a visible focus ring.
- **Money:** one component and one formatter, used everywhere.

Accessibility: text contrast at least 4.5:1, touch targets at least 44px on phones, labels on every input, `aria-label` on icon-only buttons, and the layout must work at 390px width (the sidebar becomes a top bar or drawer).

## 6. Screens

For every screen provide loading, empty and error states. An empty table says what to do next, for example "No tenants yet. Add the first one."

### 6.1 Login (`/login`)

Email and password, plain and centered on `--bg`. On success go to `/`.

### 6.2 Overview (`/`) - the reference frame

Build exactly as in the "C Console, refined" frame. Data: `GET /dashboard`. Page header with the date, a tenant/unit search box and a primary "Record payment" button. SummaryStrip: monthly rent roll (sum of `monthly_total` over active leases, computed from the returned list), then counts for overdue, grace, expiring soon and up to date. Table grouped as Needs attention (overdue and grace), Coming up (expiring soon), Up to date, with the row actions described above. Below the table, list vacant units with a "New lease" button. Clicking a tenant name opens the lease detail.

### 6.3 Record payment (dialog, opened from any row or the header)

1. Choose the lease (preselected when opened from a row; otherwise a searchable list of active leases).
2. Fields: date paid (default today), amount, method (bank, cash, mobile money), reference (shown for bank and mobile money), note.
3. Quick-fill chips under the amount: "1 month", "3 months", "6 months", filled from the lease's `next_month_charge` multiplied by the number of months. These are shortcuts only. The real numbers come from the preview.
4. A live preview panel, debounced, calling `POST /payments/preview`: covered period, months covered, new paid-through date, balance remaining ("Reste"), and the receipt wording.
5. Confirm calls `POST /payments`. On success show "Payment recorded, receipt N" with buttons **Print receipt** (the PDF blob) and **Done**. Refresh the dashboard and lease queries.

### 6.4 Lease detail (`/leases/:id`)

Header: tenant, unit, status marker, paid-through date, monthly total, deposit status. Sections: the rent sheet (`GET /leases/{id}/rent-sheet`: S/N, date, amount, period from, period to, comment, receipt link), payments with receipt and void actions (void asks for a reason of at least 3 characters and shows voided rows struck through with the reason), rent history and an "Add rent change" form (effective date, base rent, water fee, waste fee, notice date), and an "End lease" action (status, end date, deposit refunded, notes).

### 6.5 Tenants (`/tenants`, `/tenants/new`, `/tenants/:id`)

Searchable table (name, phone, current unit). The form has the contract fields: title, full name, ID type and number, where and when issued, phone, WhatsApp number, next of kin and phone. The detail page shows the tenant's leases.

### 6.6 New lease (`/leases/new`)

Three steps: house then vacant unit, tenant (search or create inline), rent terms (start date, optional end date of at most 2 years, base rent, water fee, waste fee, grace days default 5). Show the calculated deposit (2 x base rent) as read-only text. On a 409 show "This unit already has an active lease".

### 6.7 Houses and units (`/houses`)

Houses with occupancy; add and edit house; units table per house with type, description, listed rent, occupant; add and edit unit.

### 6.8 Payments (`/payments`)

All payments, newest first, filter by lease, tenant search, an "include voided" toggle, receipt link per row.

### 6.9 Expenses (`/expenses`)

Table with filters (house, category, date range) and an add and edit dialog. There is no delete.

### 6.10 Reports (`/reports`)

Month and year picker, then income, expenses and net, a by-house table, and expenses by category.

## 7. Build order

1. Project setup, tokens, fonts, generated client, login, app shell with sidebar.
2. Overview, matching the reference frame.
3. Record payment dialog with preview and receipt printing.
4. Lease detail.
5. New tenant and new lease.
6. Houses and units.
7. Payments, expenses and reports.
8. Phone layout, empty and error states, deploy.

## 8. Working agreements for the AI

- One screen per session. Finish, run it, and compare it with the reference frame before starting the next.
- Do not add dependencies without asking. Do not change the tokens or the design principles.
- Never invent fields. If the API lacks something, say so and propose a backend change instead.
- After each screen, check it at 1366px and 390px width and with the keyboard.
- Commit after every working screen.

## 9. Backend change required: payment preview

The Record payment dialog needs a dry-run endpoint so the billing rules live in one place. It has been added to the backend and tested (21 tests pass). If your backend copy already has your own fixes, add these three pieces.

`app/schemas.py` (above `PaymentOut`):

```python
class PaymentPreview(BaseModel):
    """What a payment WOULD do. Nothing is saved."""
    covers_from: date | None
    covers_to: date | None
    months_covered: int
    paid_through_after: date
    credit_toward_next_after: int
    shortfall_next_after: int
    balance_remaining: int        # the "Reste" that would print on the receipt
    purpose: str                  # the receipt wording
```

`app/services.py` (above `record_payment`):

```python
def preview_payment_effect(lease: m.Lease, data: s.PaymentIn) -> s.PaymentPreview:
    terms = lease_terms(lease)
    before = lease_credit(lease)
    after = before + data.amount
    cov = billing.payment_coverage(lease.start_date, terms, before, after)
    pos = billing.compute_position(lease.start_date, terms, after, data.paid_on, lease.grace_days)
    return s.PaymentPreview(
        covers_from=cov[0] if cov else None, covers_to=cov[1] if cov else None,
        months_covered=cov[2] if cov else 0, paid_through_after=pos.paid_through,
        credit_toward_next_after=pos.credit_toward_next, shortfall_next_after=pos.shortfall_next,
        balance_remaining=pos.shortfall_next if pos.paid_through < data.paid_on else 0,
        purpose=describe_period(cov),
    )
```

`app/routers/payments.py` (import `preview_payment_effect`, and add this above `list_payments`):

```python
@router.post("/preview", response_model=s.PaymentPreview)
def preview_payment(data: s.PaymentIn, db: Session = Depends(get_db)):
    """Dry run: what would this payment cover? Saves nothing."""
    return preview_payment_effect(get_or_404(db, m.Lease, data.lease_id, "Lease"), data)
```

After adding it, regenerate the API client.
