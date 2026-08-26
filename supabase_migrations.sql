-- =====================================================================
-- Colchester GSAR — Base Inventory
-- 001_initial.sql  (run in Supabase Dashboard -> SQL Editor -> New query)
-- Schema + Row Level Security + seed data. Idempotent where practical.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text,
  last_name    text,
  is_admin     boolean not null default false,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.teams (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text,
  floor_x    int not null default 0,
  floor_y    int not null default 0,
  floor_w    int not null default 100,
  floor_h    int not null default 100,
  sort_order int not null default 0
);

create table if not exists public.containers (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  team_id         uuid references public.teams(id) on delete set null,
  name            text not null,
  sort_order      int not null default 0,
  last_checked_at timestamptz,
  last_checked_by uuid references public.profiles(id) on delete set null,
  is_vehicle_unit boolean not null default false,
  setup_sop       text,
  takedown_sop    text,
  sop_updated_at  timestamptz,
  sop_updated_by  uuid references public.profiles(id) on delete set null
);

create table if not exists public.items (
  id                     uuid primary key default gen_random_uuid(),
  container_id           uuid not null references public.containers(id) on delete cascade,
  name                   text not null,
  qty                    int not null default 0,
  min_qty                int not null default 0,   -- low-stock threshold (0 = no alert)
  loc_detail             text,
  status                 text,
  photo_url              text,
  needs_replacement_by   date,
  needs_replacement_note text,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.profiles(id) on delete set null
);

create table if not exists public.user_teams (
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (user_id, team_id)
);

create table if not exists public.org_positions (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.org_positions(id) on delete cascade,
  title      text not null,
  sort_order int not null default 0
);

create table if not exists public.org_position_members (
  id          uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.org_positions(id) on delete cascade,
  name        text not null,
  role        text,                 -- 'Lead'/'Member' for unit-style nodes; null for plain rank nodes
  sort_order  int not null default 0
);

create table if not exists public.item_checkouts (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.items(id) on delete cascade,
  checked_out_by text not null,
  checked_out_at timestamptz not null default now(),
  due_back_at    timestamptz,
  checked_in_at  timestamptz
);

-- Full audit log of every "Take Inventory" pass (append-only).
create table if not exists public.inventory_checks (
  id           uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.containers(id) on delete cascade,
  checked_by   uuid references public.profiles(id) on delete set null,
  checked_at   timestamptz not null default now(),
  notes        text
);

create table if not exists public.inventory_check_line_items (
  id                 uuid primary key default gen_random_uuid(),
  inventory_check_id uuid not null references public.inventory_checks(id) on delete cascade,
  item_id            uuid references public.items(id) on delete set null,
  qty_before         int,
  qty_after          int
);

create index if not exists containers_room_idx on public.containers(room_id);
create index if not exists items_container_idx on public.items(container_id);
create index if not exists items_name_idx on public.items using gin (to_tsvector('simple', name));
create index if not exists checkouts_item_idx on public.item_checkouts(item_id);
create index if not exists inv_checks_container_idx on public.inventory_checks(container_id);
create index if not exists inv_check_lines_check_idx on public.inventory_check_line_items(inventory_check_id);
create index if not exists org_positions_parent_idx on public.org_positions(parent_id);
create index if not exists org_members_position_idx on public.org_position_members(position_id);

-- Safe to re-run if items table already existed before min_qty was added.
alter table public.items add column if not exists min_qty int not null default 0;
alter table public.items add column if not exists photo_url text;

-- profiles: name capture + approval gate (safe to re-run)
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists is_approved boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles drop column if exists display_name;

-- ---------------------------------------------------------------------
-- STORAGE: public bucket for item photos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

drop policy if exists "item photos public read" on storage.objects;
create policy "item photos public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'item-photos');
drop policy if exists "item photos auth insert" on storage.objects;
create policy "item photos auth insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos');
drop policy if exists "item photos auth update" on storage.objects;
create policy "item photos auth update" on storage.objects for update to authenticated
  using (bucket_id = 'item-photos');
drop policy if exists "item photos auth delete" on storage.objects;
create policy "item photos auth delete" on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos');

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, is_admin, is_approved)
  values (new.id,
          new.raw_user_meta_data->>'first_name',
          new.raw_user_meta_data->>'last_name',
          false, false)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- RLS HELPER FUNCTIONS (SECURITY DEFINER = bypass RLS internally, no recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_team_member(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select tid is not null and exists(
    select 1 from public.user_teams where user_id = auth.uid() and team_id = tid
  );
$$;

create or replace function public.can_edit_container(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(
    select 1 from public.containers c
    where c.id = cid and public.is_team_member(c.team_id)
  );
$$;

create or replace function public.can_edit_item(iid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(
    select 1 from public.items i
    join public.containers c on c.id = i.container_id
    where i.id = iid and public.is_team_member(c.team_id)
  );
$$;

-- ---------------------------------------------------------------------
-- GRANTS  (grants let a role reach a table; RLS decides rows)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.teams, public.rooms, public.containers,
  public.items, public.user_teams, public.org_positions, public.org_position_members,
  public.item_checkouts, public.inventory_checks, public.inventory_check_line_items to anon, authenticated;

grant insert, update, delete on public.teams, public.rooms, public.containers,
  public.items, public.user_teams, public.org_positions, public.org_position_members,
  public.item_checkouts to authenticated;
grant update on public.profiles to authenticated;
-- Audit log is append-only: insert only, never update/delete (not even admins).
grant insert on public.inventory_checks, public.inventory_check_line_items to authenticated;

grant execute on function public.is_admin(), public.is_team_member(uuid),
  public.can_edit_container(uuid), public.can_edit_item(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ENABLE RLS
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.teams          enable row level security;
alter table public.rooms          enable row level security;
alter table public.containers     enable row level security;
alter table public.items          enable row level security;
alter table public.user_teams     enable row level security;
alter table public.org_positions        enable row level security;
alter table public.org_position_members enable row level security;
alter table public.item_checkouts enable row level security;
alter table public.inventory_checks           enable row level security;
alter table public.inventory_check_line_items enable row level security;

-- ---------------------------------------------------------------------
-- POLICIES
-- Reads are PUBLIC (anon + authenticated). Writes are gated.
-- ---------------------------------------------------------------------

-- profiles: public read; admin manages; is_admin escalation blocked (only admins update).
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- teams: public read; admin write.
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to anon, authenticated using (true);
drop policy if exists teams_admin_all on public.teams;
create policy teams_admin_all on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- rooms: public read; admin write.
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to anon, authenticated using (true);
drop policy if exists rooms_admin_all on public.rooms;
create policy rooms_admin_all on public.rooms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- containers: public read; team members (own team) or admin write.
-- insert with check forces team_id to be one of the creator's teams (admin: any).
drop policy if exists containers_read on public.containers;
create policy containers_read on public.containers for select to anon, authenticated using (true);
drop policy if exists containers_insert on public.containers;
create policy containers_insert on public.containers for insert to authenticated
  with check (public.is_admin() or public.is_team_member(team_id));
drop policy if exists containers_update on public.containers;
create policy containers_update on public.containers for update to authenticated
  using (public.is_admin() or public.is_team_member(team_id))
  with check (public.is_admin() or public.is_team_member(team_id));
drop policy if exists containers_delete on public.containers;
create policy containers_delete on public.containers for delete to authenticated
  using (public.is_admin() or public.is_team_member(team_id));

-- items: public read; edit gated by parent container.
drop policy if exists items_read on public.items;
create policy items_read on public.items for select to anon, authenticated using (true);
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert to authenticated
  with check (public.can_edit_container(container_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items for update to authenticated
  using (public.can_edit_container(container_id))
  with check (public.can_edit_container(container_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete to authenticated
  using (public.can_edit_container(container_id));

-- item_checkouts: public read; edit gated by the item's container.
drop policy if exists checkouts_read on public.item_checkouts;
create policy checkouts_read on public.item_checkouts for select to anon, authenticated using (true);
drop policy if exists checkouts_insert on public.item_checkouts;
create policy checkouts_insert on public.item_checkouts for insert to authenticated
  with check (public.can_edit_item(item_id));
drop policy if exists checkouts_update on public.item_checkouts;
create policy checkouts_update on public.item_checkouts for update to authenticated
  using (public.can_edit_item(item_id)) with check (public.can_edit_item(item_id));
drop policy if exists checkouts_delete on public.item_checkouts;
create policy checkouts_delete on public.item_checkouts for delete to authenticated
  using (public.can_edit_item(item_id));

-- user_teams: public read; admin write.
drop policy if exists user_teams_read on public.user_teams;
create policy user_teams_read on public.user_teams for select to anon, authenticated using (true);
drop policy if exists user_teams_admin_all on public.user_teams;
create policy user_teams_admin_all on public.user_teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- org_positions + org_position_members: public read; admin write (identity/structure data).
drop policy if exists org_positions_read on public.org_positions;
create policy org_positions_read on public.org_positions for select to anon, authenticated using (true);
drop policy if exists org_positions_admin_all on public.org_positions;
create policy org_positions_admin_all on public.org_positions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists org_members_read on public.org_position_members;
create policy org_members_read on public.org_position_members for select to anon, authenticated using (true);
drop policy if exists org_members_admin_all on public.org_position_members;
create policy org_members_admin_all on public.org_position_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- inventory_checks + line items: PUBLIC read; APPEND-ONLY insert by whoever can edit the
-- container. No update/delete policies exist, so the log can never be edited or deleted (incl. admins).
drop policy if exists inv_checks_read on public.inventory_checks;
create policy inv_checks_read on public.inventory_checks for select to anon, authenticated using (true);
drop policy if exists inv_checks_insert on public.inventory_checks;
create policy inv_checks_insert on public.inventory_checks for insert to authenticated
  with check (checked_by = auth.uid() and public.can_edit_container(container_id));

drop policy if exists inv_lines_read on public.inventory_check_line_items;
create policy inv_lines_read on public.inventory_check_line_items for select to anon, authenticated using (true);
drop policy if exists inv_lines_insert on public.inventory_check_line_items;
create policy inv_lines_insert on public.inventory_check_line_items for insert to authenticated
  with check (exists (
    select 1 from public.inventory_checks ic
    where ic.id = inventory_check_id and public.can_edit_container(ic.container_id)
  ));

-- =====================================================================
-- SEED DATA  (safe to re-run: guarded by 'not exists' on teams)
-- =====================================================================
do $$
begin
  if not exists (select 1 from public.teams) then

    -- Teams (5)
    insert into public.teams (name) values
      ('Medical'), ('RPAS'), ('Rescue/Rope'), ('Logistics'), ('Command/Radio');

    -- Rooms (8) with floorplan coordinates
    insert into public.rooms (name, kind, floor_x, floor_y, floor_w, floor_h, sort_order) values
      ('Vehicle Bays',  'Garage — 8 units / trailers', 60,  80,  300, 460, 1),
      ('Tool Room',     'Storage',                     390, 80,  150, 80,  2),
      ('Classroom (1)', 'Meeting space',               390, 170, 270, 370, 3),
      ('Medical Room',  'Storage',                     670, 80,  100, 80,  4),
      ('Admin Office',  'Office',                      770, 80,  100, 80,  5),
      ('Kitchen',       'Facilities',                  870, 80,  90,  80,  6),
      ('Rest Rooms',    'Facilities',                  670, 330, 80,  100, 7),
      ('Classroom (2)', 'Meeting space',               760, 170, 200, 250, 8);

    -- Org chart starting tree (rosters intentionally empty — no names invented)
    insert into public.org_positions (parent_id, title, sort_order) values (null, 'President', 1);
    insert into public.org_positions (parent_id, title, sort_order)
      select id, 'Search Managers', 1 from public.org_positions where title = 'President';
    insert into public.org_positions (parent_id, title, sort_order)
      select id, 'Team Leads', 1 from public.org_positions where title = 'Search Managers';
    insert into public.org_positions (parent_id, title, sort_order)
      select id, 'Searchers', 1 from public.org_positions where title = 'Team Leads';
    insert into public.org_positions (parent_id, title, sort_order)
      select id, 'Medical', 2 from public.org_positions where title = 'President';
    insert into public.org_positions (parent_id, title, sort_order)
      select id, 'RPAS', 3 from public.org_positions where title = 'President';
    insert into public.org_positions (parent_id, title, sort_order)
      select id, 'Food Unit', 4 from public.org_positions where title = 'President';

    -- Vehicle Bays containers (all is_vehicle_unit = true, SOP blank)
    insert into public.containers (room_id, team_id, name, sort_order, is_vehicle_unit)
    select r.id, t.id, v.name, v.so, true
    from (values
      ('Command Post Trailer',        'Command/Radio', 1),
      ('Logistics / Food Unit',       'Logistics',     2),
      ('Remote Rescue Trailer',       'Rescue/Rope',   3),
      ('Unit #1',                     'Logistics',     4),
      ('Unit #2 — Rescue Truck',       'Rescue/Rope',   5),
      ('Unit #3',                     'Logistics',     6),
      ('Remote Rescue Vehicle (RRV)', 'Rescue/Rope',   7),
      ('RPAS Unit',                   'RPAS',          8)
    ) as v(name, team, so)
    cross join public.rooms r
    join public.teams t on t.name = v.team
    where r.name = 'Vehicle Bays';

    -- Medical Room containers (team Medical, not vehicle units)
    insert into public.containers (room_id, team_id, name, sort_order, is_vehicle_unit)
    select r.id, t.id, v.name, v.so, false
    from (values ('Shelf A', 1), ('Shelf B', 2), ('Medical Cabinet', 3)) as v(name, so)
    cross join public.rooms r
    join public.teams t on t.name = 'Medical'
    where r.name = 'Medical Room';

    -- Items (referenced by unique container name)
    insert into public.items (container_id, name, qty, loc_detail, status)
    select c.id, i.name, i.qty, i.loc, i.status
    from (values
      ('Command Post Trailer','Team radios',12,'Team Radio Room (front)','Sign-out required'),
      ('Command Post Trailer','IC command boards & forms',1,'Command Post desk','Available'),
      ('Command Post Trailer','Starlink kit',1,'Command Post desk','Available'),
      ('Logistics / Food Unit','Camp stove & cookware',1,'Galley','Available'),
      ('Logistics / Food Unit','Water jugs',6,'Storage rack','Available'),
      ('Logistics / Food Unit','Logistic supplies (misc.)',1,'Rear storage','Available'),
      ('Remote Rescue Trailer','Search vests',10,'Search Stores office','Available'),
      ('Remote Rescue Trailer','Throw-bags',6,'Search Stores office','Available'),
      ('Remote Rescue Trailer','PFDs',10,'Search Stores office','Available'),
      ('Remote Rescue Trailer','First Aid Post kit',1,'Front comfort area','Available'),
      ('Unit #1','General search equipment',1,'Rear of truck','Available'),
      ('Unit #2 — Rescue Truck','Rope rescue gear',1,'Rear compartment','Available'),
      ('Unit #2 — Rescue Truck','Medical backpacks',2,'Rear compartment','Available'),
      ('Unit #2 — Rescue Truck','Rescue litter',1,'Rear compartment','Available'),
      ('Unit #3','Personal gear racks',1,'Cabin (seats up to 8)','Available'),
      ('Remote Rescue Vehicle (RRV)','Oxygen kit',1,'Onboard storage','Available'),
      ('Remote Rescue Vehicle (RRV)','AED',1,'Onboard storage','Available'),
      ('Remote Rescue Vehicle (RRV)','Medical packs',2,'Onboard storage','Available'),
      ('Remote Rescue Vehicle (RRV)','Radios & GPS',1,'Onboard storage','Available'),
      ('RPAS Unit','Drone (RPAS aircraft)',1,'Hard case','Available'),
      ('RPAS Unit','Batteries',4,'Hard case','Available'),
      ('RPAS Unit','Controller',1,'Hard case','Available'),
      ('RPAS Unit','Starlink kit',1,'Hard case','Available'),
      ('RPAS Unit','Spare propellers',1,'Hard case, side pocket','Available'),
      ('Shelf A','Emergency blankets',8,'Bin 1','Available'),
      ('Shelf A','Trauma dressing kit',5,'Bin 2','Available'),
      ('Shelf B','SAM Splint — Adult',6,'Bin 3, upper shelf','Available'),
      ('Shelf B','Gauze rolls',24,'Bin 4','Available'),
      ('Shelf B','Tourniquets (CAT)',4,'Bin 5','Available')
    ) as i(cname, name, qty, loc, status)
    join public.containers c on c.name = i.cname;

    -- Medical Cabinet oxygen kit (working example of needs_replacement_by ~3 months out)
    insert into public.items (container_id, name, qty, loc_detail, status, needs_replacement_by, needs_replacement_note)
    select c.id, 'Oxygen kit', 1, 'Lower cabinet', 'Inspect Sept',
           (current_date + interval '3 months')::date, 'Cylinder inspection due'
    from public.containers c where c.name = 'Medical Cabinet';

  end if;
end $$;
