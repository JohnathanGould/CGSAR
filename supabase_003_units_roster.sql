-- =====================================================================
-- Colchester GSAR — Base Inventory
-- 003_units_roster.sql  (run in Supabase Dashboard -> SQL Editor)
-- Loads the "Units/Groups" sheet (revised 9/17/2026) into the org chart:
--   * fills the Logistic / Planning / Operations Chief positions
--   * creates each unit under its chief (if missing) with its lead + members
-- Re-running resets these chiefs and units to match this sheet (any manual
-- edits to them in the app are replaced). Nothing else is touched.
-- Stops with an error, changing nothing, if a chief position isn't found.
-- =====================================================================

do $$
declare
  rec       record;
  v_parent uuid;
  v_unit   uuid;
begin
  -- Units created/found in step 2, so step 3 targets exactly those (other
  -- positions with the same title elsewhere in the chart are left alone).
  create temp table _units (title text primary key, id uuid not null) on commit drop;

  -- 1. Chiefs: who fills each executive position.
  for rec in select * from (values
    ('Logistic Chief',   'Tom'),
    ('Planning Chief',   'Crystal'),
    ('Operations Chief', 'Amy')
  ) as v(position, person) loop
    select id into v_parent from public.org_positions
      where lower(trim(title)) = lower(rec.position) limit 1;
    if v_parent is null then
      raise exception 'Org chart position "%" not found — check its exact title', rec.position;
    end if;
    delete from public.org_position_members where position_id = v_parent;
    insert into public.org_position_members (position_id, name, role, sort_order)
      values (v_parent, rec.person, null, 1);
  end loop;

  -- 2. Units under each chief (or under the President for committees).
  for rec in select * from (values
    ('Logistic Chief',   'Facilities',     1),
    ('Logistic Chief',   'Ground Support', 2),
    ('Logistic Chief',   'Food Unit',      3),
    ('Logistic Chief',   'Medical',        4),
    ('Logistic Chief',   'Comms',          5),
    ('Logistic Chief',   'Supplies',       6),
    ('Planning Chief',   'IT',             1),
    ('Planning Chief',   'Mental Health',  2),
    ('Planning Chief',   'Documentation',  3),
    ('Operations Chief', 'Rope Access',    1),
    ('Operations Chief', 'Tracking',       2),
    ('Operations Chief', 'K9',             3),
    ('Operations Chief', 'RPAS',           4),
    ('Operations Chief', 'OHV',            5),
    ('President',        'Fundraising Committee (stood down)', 1)
  ) as v(parent, unit, so) loop
    select id into v_parent from public.org_positions
      where lower(trim(title)) = lower(rec.parent) limit 1;
    if v_parent is null then
      raise exception 'Org chart position "%" not found — check its exact title', rec.parent;
    end if;
    select id into v_unit from public.org_positions
      where org_positions.parent_id = v_parent and lower(trim(title)) = lower(rec.unit) limit 1;
    if v_unit is null then
      insert into public.org_positions (parent_id, title, sort_order)
        values (v_parent, rec.unit, rec.so) returning id into v_unit;
    end if;
    delete from public.org_position_members where position_id = v_unit;
    insert into _units values (lower(rec.unit), v_unit);
  end loop;

  -- 3. Rosters: one row per person per unit, leads first (as on the sheet).
  for rec in select * from (values
    ('Facilities', 'James', 'Lead', 1), ('Facilities', 'Richard F', 'Member', 2), ('Facilities', 'Alex', 'Member', 3),
    ('Facilities', 'Malcolm', 'Member', 4), ('Facilities', 'Karen', 'Member', 5), ('Facilities', 'Patti', 'Member', 6),
    ('Facilities', 'Alexandra', 'Member', 7), ('Facilities', 'Crystal', 'Member', 8), ('Facilities', 'Marianne', 'Member', 9),

    ('Ground Support', 'Mark M', 'Member', 2), ('Ground Support', 'Tanya', 'Member', 3), ('Ground Support', 'Dave S', 'Member', 4),
    ('Ground Support', 'Jody', 'Member', 5), ('Ground Support', 'Mark N', 'Member', 6),

    ('Food Unit', 'Cathy', 'Lead', 1), ('Food Unit', 'Caitlyn', 'Member', 2), ('Food Unit', 'Mark M', 'Member', 3),
    ('Food Unit', 'Nancy', 'Member', 4), ('Food Unit', 'Darlene', 'Member', 5), ('Food Unit', 'Tracy H', 'Member', 6),
    ('Food Unit', 'Alexandra', 'Member', 7), ('Food Unit', 'Erin', 'Member', 8), ('Food Unit', 'Erica', 'Member', 9),
    ('Food Unit', 'Patti', 'Member', 10), ('Food Unit', 'Marianne', 'Member', 11),

    ('Medical', 'Gillian', 'Lead', 1), ('Medical', 'James', 'Member', 2), ('Medical', 'Crystal', 'Member', 3),
    ('Medical', 'Alexandra', 'Member', 4), ('Medical', 'Ali', 'Member', 5), ('Medical', 'Agatha', 'Member', 6),
    ('Medical', 'Heather', 'Member', 7), ('Medical', 'Ciara', 'Member', 8), ('Medical', 'Patti', 'Member', 9),
    ('Medical', 'Tanya', 'Member', 10),

    ('Comms', 'Crystal', 'Lead', 1), ('Comms', 'Susan', 'Member', 2), ('Comms', 'Ciara', 'Member', 3),
    ('Comms', 'Fraser', 'Member', 4), ('Comms', 'Craig', 'Member', 5), ('Comms', 'Hazel', 'Member', 6),
    ('Comms', 'Dave Crosby', 'Member', 7), ('Comms', 'Ocean-Mist', 'Member', 8), ('Comms', 'Marianne', 'Member', 9),
    ('Comms', 'Jaiden', 'Member', 10),

    ('Supplies', 'Jeff', 'Lead', 1),

    ('IT', 'Craig', 'Lead', 1), ('IT', 'Evan', 'Member', 2),

    ('Mental Health', 'Ruth', 'Lead', 1), ('Mental Health', 'Nancy', 'Member', 2), ('Mental Health', 'Caitlyn', 'Member', 3),
    ('Mental Health', 'Jackie', 'Member', 4), ('Mental Health', 'Jude', 'Member', 5), ('Mental Health', 'Jacqueline', 'Member', 6),

    ('Documentation', 'Monique', 'Member', 2), ('Documentation', 'Jesse', 'Member', 3), ('Documentation', 'Kelly', 'Member', 4),
    ('Documentation', 'Patti', 'Member', 5), ('Documentation', 'Ruth', 'Member', 6),

    ('Rope Access', 'Amy', 'Lead', 1), ('Rope Access', 'Jeff', 'Member', 2), ('Rope Access', 'Ali', 'Member', 3),
    ('Rope Access', 'Alex', 'Member', 4), ('Rope Access', 'Richard', 'Member', 5), ('Rope Access', 'Cory', 'Member', 6),
    ('Rope Access', 'Kelly', 'Member', 7),

    ('Tracking', 'James', 'Lead', 1), ('Tracking', 'Craig', 'Member', 2), ('Tracking', 'Malcolm', 'Member', 3),
    ('Tracking', 'Ali', 'Member', 4), ('Tracking', 'Crystal', 'Member', 5), ('Tracking', 'Ciara', 'Member', 6),
    ('Tracking', 'Heather', 'Member', 7), ('Tracking', 'George', 'Member', 8), ('Tracking', 'Kelly', 'Member', 9),

    ('K9', 'Susan', 'Lead', 1), ('K9', 'Amy', 'Member', 2), ('K9', 'Gillian', 'Member', 3),
    ('K9', 'Heather', 'Member', 4), ('K9', 'Patti', 'Member', 5),

    ('RPAS', 'Scott', 'Lead', 1), ('RPAS', 'Evan', 'Member', 2), ('RPAS', 'Fraser', 'Member', 3),
    ('RPAS', 'Craig', 'Member', 4), ('RPAS', 'Richard', 'Member', 5), ('RPAS', 'Steve Currie', 'Member', 6),
    ('RPAS', 'Erica', 'Member', 7),

    ('OHV', 'Mark N', 'Lead', 1), ('OHV', 'Tanya', 'Member', 2), ('OHV', 'Craig', 'Member', 3),
    ('OHV', 'Mark M', 'Member', 4), ('OHV', 'Karen', 'Member', 5), ('OHV', 'Evan', 'Member', 6),
    ('OHV', 'Amy', 'Member', 7), ('OHV', 'Tracy H', 'Member', 8), ('OHV', 'Cory', 'Member', 9),
    ('OHV', 'Jeff', 'Member', 10),

    ('Fundraising Committee (stood down)', 'Jeff', 'Lead', 1)
  ) as v(unit, person, role, so) loop
    select id into v_unit from _units where title = lower(rec.unit);
    insert into public.org_position_members (position_id, name, role, sort_order)
      values (v_unit, rec.person, rec.role, rec.so);
  end loop;
end $$;
