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
2. **Authentication → Providers → Email:** enable Email. For a quick internal tool you can turn
   *Confirm email* OFF so new logins work immediately.
3. **Authentication → URL Configuration:** set Site URL + a redirect of your GitHub Pages URL, e.g.
   `https://your-user.github.io/your-repo/` and `https://your-user.github.io/your-repo/**`.

## 2. Create the first admin

Create a login from the app (Sign in → Create account). Then run this once in the SQL editor,
replacing the email:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

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

## Known limitation (v1)

Base and RPAS units have Starlink, but Units #1–#3, the Remote Rescue Trailer, and the RRV may be
out of coverage on a callout. **Full offline read/write sync is out of scope for v1.** As a
stopgap, the app caches the last successfully loaded data in `localStorage`, so last-known
locations remain visible without a connection (writes still require connectivity).

## Near-term (not built yet)

QR codes per container that deep-link into a container view. Routing already reads `?container=<id>`
from the URL on load, so QR generation can be layered on later without structural changes.
