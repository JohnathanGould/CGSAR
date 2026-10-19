-- =====================================================================
-- Colchester GSAR — Base Inventory
-- 005_reminders.sql  (run in Supabase Dashboard -> SQL Editor)
-- Due dates that aren't an item's own expiry: a vehicle's MVI,
-- registration, insurance, or association-wide renewals. Shown on the
-- Dashboard when overdue or due within 30 days.
--   * container_id set  -> belongs to that unit; its team or an admin edits
--   * container_id null -> general reminder; admins only
-- Safe to re-run.
-- =====================================================================

create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  container_id  uuid references public.containers(id) on delete cascade,
  title         text not null,
  due_date      date not null,
  note          text,
  repeat_months int check (repeat_months is null or repeat_months > 0),  -- e.g. 12 for an annual MVI
  last_done_at  date,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);
create index if not exists reminders_container_idx on public.reminders(container_id);
create index if not exists reminders_due_idx on public.reminders(due_date);

create or replace function public.can_edit_reminder(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when cid is null then public.is_admin() else public.can_edit_container(cid) end;
$$;
grant execute on function public.can_edit_reminder(uuid) to anon, authenticated;

grant select on public.reminders to anon, authenticated;
grant insert, update, delete on public.reminders to authenticated;
alter table public.reminders enable row level security;

drop policy if exists reminders_read on public.reminders;
create policy reminders_read on public.reminders for select to anon, authenticated using (true);
drop policy if exists reminders_insert on public.reminders;
create policy reminders_insert on public.reminders for insert to authenticated
  with check (public.can_edit_reminder(container_id));
drop policy if exists reminders_update on public.reminders;
create policy reminders_update on public.reminders for update to authenticated
  using (public.can_edit_reminder(container_id)) with check (public.can_edit_reminder(container_id));
drop policy if exists reminders_delete on public.reminders;
create policy reminders_delete on public.reminders for delete to authenticated
  using (public.can_edit_reminder(container_id));

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at before update on public.reminders
for each row execute function public.set_updated_at();
