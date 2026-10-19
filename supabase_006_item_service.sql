-- =====================================================================
-- Colchester GSAR — Base Inventory
-- 006_item_service.sql  (run in Supabase Dashboard -> SQL Editor)
-- Adds an item "type" (e.g. ABC 5 lb, CO2) and a last-service date, shown
-- in the Inventory search table alongside the next service / expiry date
-- (the existing needs_replacement_by column). Safe to re-run.
-- =====================================================================

alter table public.items add column if not exists item_type text;
alter table public.items add column if not exists last_serviced_at date;
