-- =====================================================================
-- Colchester GSAR — Base Inventory
-- 004_unit_documents.sql  (run in Supabase Dashboard -> SQL Editor)
-- PDF documents (setup / takedown SOPs, manuals) attached to a unit.
-- Files live in the public 'unit-docs' storage bucket under <unit id>/...;
-- anyone can read them, only the unit's team or an admin can add/remove.
-- Safe to re-run.
-- =====================================================================

create table if not exists public.unit_documents (
  id           uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.containers(id) on delete cascade,
  title        text not null,
  file_path    text not null,          -- path inside the 'unit-docs' bucket
  url          text not null,          -- public URL of the PDF
  sort_order   int not null default 0,
  uploaded_at  timestamptz not null default now(),
  uploaded_by  uuid references public.profiles(id) on delete set null
);
create index if not exists unit_documents_container_idx on public.unit_documents(container_id);

grant select on public.unit_documents to anon, authenticated;
grant insert, update, delete on public.unit_documents to authenticated;
alter table public.unit_documents enable row level security;

drop policy if exists unit_docs_read on public.unit_documents;
create policy unit_docs_read on public.unit_documents for select to anon, authenticated using (true);
drop policy if exists unit_docs_insert on public.unit_documents;
create policy unit_docs_insert on public.unit_documents for insert to authenticated
  with check (public.can_edit_container(container_id));
drop policy if exists unit_docs_update on public.unit_documents;
create policy unit_docs_update on public.unit_documents for update to authenticated
  using (public.can_edit_container(container_id)) with check (public.can_edit_container(container_id));
drop policy if exists unit_docs_delete on public.unit_documents;
create policy unit_docs_delete on public.unit_documents for delete to authenticated
  using (public.can_edit_container(container_id));

-- Storage bucket: public read, PDFs only, 25 MB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-docs', 'unit-docs', true, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Who can write a file: decided by the unit id that is the file's first folder.
create or replace function public.can_edit_unit_doc_path(path text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cid uuid;
begin
  begin
    cid := split_part(path, '/', 1)::uuid;
  exception when others then
    return false;  -- not a <unit id>/... path
  end;
  return public.can_edit_container(cid);
end; $$;
grant execute on function public.can_edit_unit_doc_path(text) to authenticated;

drop policy if exists "unit docs public read" on storage.objects;
create policy "unit docs public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'unit-docs');
drop policy if exists "unit docs team insert" on storage.objects;
create policy "unit docs team insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'unit-docs' and public.can_edit_unit_doc_path(name));
drop policy if exists "unit docs team update" on storage.objects;
create policy "unit docs team update" on storage.objects for update to authenticated
  using (bucket_id = 'unit-docs' and public.can_edit_unit_doc_path(name));
drop policy if exists "unit docs team delete" on storage.objects;
create policy "unit docs team delete" on storage.objects for delete to authenticated
  using (bucket_id = 'unit-docs' and public.can_edit_unit_doc_path(name));
