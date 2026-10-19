# Colchester GSAR — Base Inventory

A digital floorplan + equipment locator for Colchester Ground Search and Rescue's home base
(73 Ventura Dr, Debert, NS). Browse **Room → Container ("shelf") → Item**, or search an item and jump
straight to its location.

- **Frontend:** plain client-side React SPA (Vite). Deployable to GitHub Pages.
- **Backend:** Supabase (Postgres + auto REST API + Auth + Row Level Security). No custom server —
  the browser talks directly to Supabase with the public anon key; RLS enforces all writes.

## 1. Set up Supabase

1. In your Supabase project, open **SQL Editor → New query**, paste the whole of
   [`supabase_migrations.sql`](./supabase_migrations.sql), and **Run**. This creates all tables,
   RLS policies, and seed data (5 teams, 8 rooms, Vehicle Bays + Medical Room inventory, 3 units).
   Then do the same with [`supabase_002_vehicle_compartments.sql`](./supabase_002_vehicle_compartments.sql),
   which adds vehicle compartments (and starter compartments for the RPAS Unit). Both files are safe
   to re-run, so an existing database only needs the second one.
   Optionally, run [`supabase_003_units_roster.sql`](./supabase_003_units_roster.sql) to load the
   Units/Groups sheet (chiefs, units, leads and members) into the org chart. Re-running it resets
   those units to match the sheet.
   Run [`supabase_004_unit_documents.sql`](./supabase_004_unit_documents.sql) to enable SOP PDF
   documents on vehicle/trailer units (creates the `unit-docs` storage bucket and its permissions).
   Run [`supabase_005_reminders.sql`](./supabase_005_reminders.sql) to enable service dates (MVI,
   registration, renewals) on units and general reminders on the Dashboard.
   Run [`supabase_006_item_service.sql`](./supabase_006_item_service.sql) to add item Type and
   Last serviced fields (shown in the Inventory search table).
2. **Authentication → Providers → Email:** enable Email. For a quick internal tool you can turn
   *Confirm email* OFF so new logins work immediately.
3. **Authentication → URL Configuration:** set Site URL + a redirect of your GitHub Pages URL, e.g.
   `https://your-user.github.io/your-repo/` and `https://your-user.github.io/your-repo/**`.

## 2. Create the first admin

Create a login from the app (Sign in → Create account). Then run this once in the SQL editor,
replacing the email:

```sql
update public.profiles set is_admin = true, is_approved = true
where id = (select id from auth.users where email = 'you@example.com');
```

Admins bypass the approval gate. Everyone else signs up, lands on a "pending admin approval" screen, and gets in once an admin approves them (and assigns their team[s]) from **Admin → Pending**.

Admins can create/edit rooms & teams, assign team memberships, reassign container ownership,
and manage the Units roster.

## 3. Run locally

```bash
cp .env.example .env   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
yarn install
yarn dev               # http://localhost:3000
```

## 4. Deploy to GitHub Pages

The two Supabase values are **public** (browser bundle). In the repo, add them as
**Settings → Secrets and variables → Actions → secrets**: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`. Then enable **Settings → Pages → Source: GitHub Actions**. The included
workflow (`.github/workflows/deploy.yml`) builds and publishes `dist/` on every push to `main`.

(`vite.config.js` uses `base: './'` so the build works under any `/repo-name/` path.)

## Access model (enforced by RLS, not just the UI)

- **Public / no login:** read-only browse + search of every room, container, item.
- **Logged in, not admin:** edit controls (add/edit/delete item, Take Inventory, sign-out/check-in,
  create/delete a shelf assigned to your own team) only on containers whose team matches one of
  your teams (`user_teams`). Read-only everywhere else.
- **Admin:** full edit everywhere + rooms/teams CRUD, membership assignment, container team
  reassignment, and the Units roster.

## Vehicle compartments

Vehicle / trailer units can be split into named compartments, each on a side of the unit
(driver side, passenger side, rear, interior, roof, cab) and ordered front → back. Opening a vehicle
shows a top-down diagram of the unit; searching for an item lights up the compartment it's in, and
search results read *RPAS Unit → Driver rear → Generator*. Anyone who can edit the unit (its team or
an admin) can add, rename, reorder or delete compartments via **Manage compartments**, and pick an
item's compartment in the item form.

## Known limitation (v1)

Base and RPAS units have Starlink, but Units #1–#3, the Remote Rescue Trailer, and the RRV may be
out of coverage on a callout. **Full offline read/write sync is out of scope for v1.** As a
stopgap, the app caches the last successfully loaded data in `localStorage`, so last-known
locations remain visible without a connection (writes still require connectivity).

## Near-term (not built yet)

QR codes per container that deep-link into a container view. Routing already reads `?container=<id>`
from the URL on load, so QR generation can be layered on later without structural changes.
