-- =====================================================================
-- Colchester GSAR — Base Inventory
-- 002_vehicle_compartments.sql  (run AFTER supabase_migrations.sql)
-- Adds named compartments to vehicle/trailer units so every item can be
-- placed in a specific outer door, the interior, the cab or the roof.
-- Safe to re-run.
-- =====================================================================

create table if not exists public.compartments (
  id           uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.containers(id) on delete cascade,
  name         text not null,
  -- Which face of the vehicle the compartment opens from.
  -- 'driver' / 'passenger' = outer side doors, ordered front -> back by sort_order.
  side         text not null default 'interior'
               check (side in ('driver', 'passenger', 'rear', 'interior', 'roof', 'cab')),
  sort_order   int not null default 0,
  notes        text
);

create index if not exists compartments_container_idx on public.compartments(container_id);

-- Items optionally sit in a compartment of their container. Deleting a
-- compartment keeps its items (they just become "unassigned").
alter table public.items
  add column if not exists compartment_id uuid references public.compartments(id) on delete set null;
create index if not exists items_compartment_idx on public.items(compartment_id);

-- Grants + RLS: public read; edit gated by the parent container, same as items.
grant select on public.compartments to anon, authenticated;
grant insert, update, delete on public.compartments to authenticated;

alter table public.compartments enable row level security;

drop policy if exists compartments_read on public.compartments;
create policy compartments_read on public.compartments for select to anon, authenticated using (true);
drop policy if exists compartments_insert on public.compartments;
create policy compartments_insert on public.compartments for insert to authenticated
  with check (public.can_edit_container(container_id));
drop policy if exists compartments_update on public.compartments;
create policy compartments_update on public.compartments for update to authenticated
  using (public.can_edit_container(container_id))
  with check (public.can_edit_container(container_id));
drop policy if exists compartments_delete on public.compartments;
create policy compartments_delete on public.compartments for delete to authenticated
  using (public.can_edit_container(container_id));

-- Starter compartments for the RPAS Unit (ex-ambulance box truck), taken from
-- photos of the passenger side, rear and roof. Driver-side doors are left for
-- the RPAS team to add in the app. Only runs if the unit has none yet.
do $$
declare rpas uuid;
begin
  select id into rpas from public.containers where name = 'RPAS Unit' limit 1;
  if rpas is not null and not exists (select 1 from public.compartments where container_id = rpas) then
    insert into public.compartments (container_id, name, side, sort_order) values
      (rpas, 'Front upper compartment', 'passenger', 1),
      (rpas, 'Front lower compartment', 'passenger', 2),
      (rpas, 'Main cabin (side door)',  'interior',  1),
      (rpas, 'Rear doors',              'rear',      1),
      (rpas, 'Starlink mount',          'roof',      1),
      (rpas, 'Cab',                     'cab',       1);
  end if;
end $$;
