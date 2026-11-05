# AMS backend (FastAPI)

REST API for the L&N Apartment Management System: houses, units, tenants, leases,
payments, PDF receipts, dashboard, expenses and monthly reports.

## Run it (uv)

```bash
uv sync                                                    # installs everything from pyproject.toml / uv.lock
uv run python -m app.cli create-user --name "Your Name" --email you@example.com
uv run python -m app.cli seed-demo                         # optional: FAKE demo data for development
uv run uvicorn app.main:app --reload
uv run pytest                                              # run the tests
```

Open http://localhost:8000/docs for the interactive API. Log in with the **Authorize** button
(username = your email). Add a library with `uv add <package>`.

## Database: SQLite now, PostgreSQL later

The prototype uses a single SQLite file (`ams.db`, created automatically). That is plenty for three
users: it runs in WAL mode so near-simultaneous writes queue instead of failing.

- **Back it up:** copy `ams.db` daily (or run `sqlite3 ams.db ".backup backup.db"` for a safe copy while the app runs).
- **Host with a persistent disk.** Free hosting tiers with an ephemeral filesystem wipe the file on every restart.
- **Moving to PostgreSQL later** only needs `uv add "psycopg[binary]"` and a new `DATABASE_URL`
  (`postgresql+psycopg://user:pass@host/db`), plus Alembic migrations. The models work on both.

## Settings (environment variables)

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./ams.db` | SQLite for the prototype; see the database section for PostgreSQL |
| `SECRET_KEY` | `change-me-in-production` | **Set a long random value in production** |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated frontend URLs |
| `BUSINESS_NAME` | `L&N Apartments` | Printed on receipts |
| `RECEIPT_PLACE` | `Buea` | "À / At" on receipts |
| `TIMEZONE` | `Africa/Douala` | "Today" for overdue calculations |

## Endpoints

| Domain | Router File | Endpoints |
| --- | --- | --- |
| Auth | `routers/auth.py` | `POST /auth/login`, `GET /auth/me`, `POST /auth/users` |
| Houses | `routers/houses.py` | `POST /houses`, `GET /houses`, `GET /houses/{id}`, `PATCH /houses/{id}` |
| Units | `routers/units.py` | `POST /units`, `GET /units` (`?house_id=`, `?vacant=`), `GET /units/{id}`, `PATCH /units/{id}` |
| Tenants | `routers/tenants.py` | `POST /tenants`, `GET /tenants` (`?q=`), `GET /tenants/{id}`, `PATCH /tenants/{id}` |
| Leases | `routers/leases.py` | `POST /leases`, `GET /leases`, `GET /leases/{id}`, `POST /leases/{id}/terms`, `POST /leases/{id}/end`, `GET /leases/{id}/rent-sheet` |
| Payments | `routers/payments.py` | `POST /payments`, `GET /payments`, `POST /payments/{id}/void`, `GET /payments/{id}/receipt.pdf` |
| Adjustments | `routers/adjustments.py` | `POST /adjustments` |
| Expenses | `routers/expenses.py` | `POST /expenses`, `GET /expenses` (`?house_id=&category=&date_from=&date_to=`), `PATCH /expenses/{id}` |
| Dashboard | `routers/dashboard.py` | `GET /dashboard` (`?expiring_days=30`) |
| Reports | `routers/reports.py` | `GET /reports/monthly?year=&month=` |
| Audit Trail | `routers/audit.py` | `GET /audit-log` (`?entity_type=&action=&source=&limit=`) |

## How the money logic works

Paid-through date and balances are **never stored**. `app/billing.py` derives them from
payments + adjustments + the lease's rent terms by spending the credit month by month from the
lease start. This covers 1/3/6-month payments, partial payments and rent increases with one rule.
Payments are voided (with a reason), never deleted, and every change is written to `audit_log`.

## Layout

```
app/models.py      database tables         app/billing.py   paid-through logic (pure Python)
app/services.py    shared business logic   app/receipts.py  receipt PDF
app/routers/       API routes              app/cli.py       create-user, seed-demo
tests/             billing + API tests
```

## Before going live

- Add Alembic migrations (tables are auto-created for now), and move to PostgreSQL if usage outgrows SQLite.
- Set a strong `SECRET_KEY`, serve over HTTPS, schedule daily database backups.
