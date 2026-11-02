# Trunks MIS

A one-user management app for the Central Record Office's record trunks. It replaces the
**Trunks Status** and **New Trunks 2026 May** sheets: every delivery of trunks to a branch, its
record-shifting progress, and its invoice and payment, all in one place.

Next.js (frontend and backend) + Supabase Postgres. No ORM: the server talks to Supabase directly.
Region, zone and branch fields use a searchable picker where you can also add, edit and delete entries in place.

## Run it

```sh
npm install
npm run dev          # http://localhost:3000, sign in with APP_PASSWORD from .env.local
```

`.env.local` (see `.env.example`):

| Variable | What it is |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | The Supabase project (shared with `../coderpad`). Server only. |
| `APP_PASSWORD` | The single user's password |
| `SESSION_SECRET` | Long random string that signs the login cookie |

**Database, one time:** run `supabase/schema.sql` in the Supabase SQL editor. It only creates
`trunk_*` tables and functions, so nothing else in the project is touched. Then load the workbook:

```sh
npm run import -- data.xlsx         # dry run: counts and warnings, nothing written
npm run import -- data.xlsx --yes   # replaces all app data with the workbook (one transaction)
```

## What the two sheets were doing

- **Trunks Status**: one row per delivery to a branch since 2024. It records trunks and stands
  received, trunks used, the balance left, and whether the branch has finished shifting its records
  into them. This is the operations view.
- **New Trunks 2026 May**: the newest deliveries again, now billed: invoice number, invoice amount,
  amount receivable after 5.5% tax is withheld, payment date, and Clear/Pending. This is the billing view.

Both describe the same thing, a **delivery**, so the app has one `trunk_deliveries` table (plus
`trunk_branches`). On import, each May row is merged into its Trunks Status row (same branch and
same trunks received).

## Pages

| Page | What it's for |
| --- | --- |
| Dashboard | Trunks in use, shifting progress, invoiced / received / outstanding, monthly charts, oldest unpaid invoices, shifting not started. Everything clicks through to the rows behind it. |
| Deliveries | The full register: search, filters (region, zone, shifting, billing, data issue, date range, unused trunks), sort on any column, live totals, CSV export. Filters live in the URL, so views can be bookmarked. Click a row for details, one-click *Mark paid* / *Mark shifting complete*, edit, or delete. |
| Branches | Per-branch totals and filters (owing money, shifting pending, unused trunks, no region). Each branch has a history page and timeline. Renaming a code updates every delivery. |
| Reports | By region, by zone, outstanding by age (0–30 / 31–60 / 61–90 / 90+ days), month by month. Each table has CSV export, and the page prints cleanly. |
| Data checks | Missing dates, branches without a region, more trunks used than received, used but "not started", paid without a date, duplicate invoice numbers, payments over 60 days, and more. |
| Regions | Add, rename (all branches follow), merge into another region, or delete. Shows each region's zones, branches and totals. Zones can be renamed or cleared there too. |

## Rules the app applies

- Receivable = invoice amount × (1 − tax %). Tax defaults to 5.5% and can be changed per delivery.
- Billing status: *Not invoiced* → *Awaiting payment* → *Part paid* → *Paid*. Deliveries from
  before the billing list are *No billing record* and are left out of money totals.
- Days outstanding count from the invoice date, which is read from the end of the invoice number
  (`22/I-902/22/6/2026` → 22 Jun 2026), or from the delivery date if there's no invoice date.

## Import clean-ups (printed as warnings by `npm run import`)

- 2026 dates that Excel read as month/day are swapped back (2026-12-05 → 12 May 2026). Text dates are read as day/month.
- 16 Trunks Status rows pasted from the May list had Region in the Date column. They're read with the columns put back in place.
- Region spellings are tidied: Gugrat → Gujrat, Faisalabad B → Faisalabad-B, Faisalabad A → Faisalabad-A.
- Trunks Status has no region column, so regions and zones come from the other sheets, used only as a lookup.
- A number in "Trunks Type" is stored as *Old* trunks with that count.
