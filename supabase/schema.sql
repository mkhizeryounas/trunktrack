-- Trunks MIS: run once in the Supabase SQL editor (Project → SQL Editor → New query → Run).
-- Tables are prefixed with trunk_ so they sit safely next to the other app in this project.

create table if not exists trunk_branches (
  code        text primary key,                 -- branch code, e.g. '819', or a department like 'Finance'
  name        text,                              -- optional display name
  region      text,
  zone        text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- One row per delivery of trunks to a branch.
-- Operations side  = Trunks Status sheet (shifting progress, trunks used, balance).
-- Billing side     = New Trunks 2026 May sheet (invoice, payment).
create table if not exists trunk_deliveries (
  id                bigint generated always as identity primary key,
  ref_no            integer,                     -- Sr No from the Trunks Status sheet
  branch_code       text not null references trunk_branches(code) on update cascade,
  delivered_on      date,
  trunk_type        text not null default 'New' check (trunk_type in ('New','Old')),
  old_trunks        integer,                     -- the sheet sometimes holds a count instead of New/Old
  trunks_received   integer not null default 0 check (trunks_received >= 0),
  stands_received   integer not null default 0 check (stands_received >= 0),
  trunks_used       integer not null default 0 check (trunks_used >= 0),
  shifting_status   text not null default 'not_started'
                    check (shifting_status in ('not_started','in_progress','complete','official')),
  shifting_done_on  date,
  billing_tracked   boolean not null default true, -- false = delivered before the billing list started
  invoice_no        text,
  invoice_date      date,
  invoice_amount    numeric(12,2) check (invoice_amount >= 0),
  tax_rate          numeric(5,2) not null default 5.5,  -- % withheld: receivable = invoice × (1 − tax/100)
  amount_received   numeric(12,2) check (amount_received >= 0),
  payment_date      date,
  remarks           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists trunk_deliveries_branch_idx on trunk_deliveries(branch_code);
create index if not exists trunk_deliveries_date_idx   on trunk_deliveries(delivered_on);

-- Only the app's server (secret key) reads and writes these tables; public keys get nothing.
alter table trunk_branches   enable row level security;
alter table trunk_deliveries enable row level security;

-- Keep updated_at current on every edit.
create or replace function trunk_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trunk_deliveries_touch on trunk_deliveries;
create trigger trunk_deliveries_touch before update on trunk_deliveries
  for each row execute function trunk_touch_updated_at();

-- Import from Excel: replaces all data in ONE transaction, so a failed import leaves the old data intact.
create or replace function trunk_replace_all(p_branches jsonb, p_deliveries jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from trunk_deliveries where true;
  delete from trunk_branches where true;
  insert into trunk_branches (code, name, region, zone, notes)
    select code, name, region, zone, notes from jsonb_populate_recordset(null::trunk_branches, p_branches);
  insert into trunk_deliveries (ref_no, branch_code, delivered_on, trunk_type, old_trunks, trunks_received,
      stands_received, trunks_used, shifting_status, shifting_done_on, billing_tracked, invoice_no, invoice_date,
      invoice_amount, tax_rate, amount_received, payment_date, remarks)
    select ref_no, branch_code, delivered_on, trunk_type, old_trunks, trunks_received,
      stands_received, trunks_used, shifting_status, shifting_done_on, billing_tracked, invoice_no, invoice_date,
      invoice_amount, coalesce(tax_rate, 5.5), amount_received, payment_date, remarks
    from jsonb_populate_recordset(null::trunk_deliveries, p_deliveries);
end $$;
revoke execute on function trunk_replace_all(jsonb, jsonb) from public, anon, authenticated;
grant execute on function trunk_replace_all(jsonb, jsonb) to service_role;

-- Regions as a managed list. Safe to run more than once.
create table if not exists trunk_regions (
  name        text primary key,
  notes       text,
  created_at  timestamptz not null default now()
);
alter table trunk_regions enable row level security;

insert into trunk_regions (name)
  select distinct region from trunk_branches where region is not null
  on conflict do nothing;

-- Renaming a region renames it on every branch; deleting it leaves those branches without a region.
alter table trunk_branches drop constraint if exists trunk_branches_region_fkey;
alter table trunk_branches add constraint trunk_branches_region_fkey
  foreign key (region) references trunk_regions(name) on update cascade on delete set null;

-- Import keeps the managed regions and adds any new ones found in the workbook.
create or replace function trunk_replace_all(p_branches jsonb, p_deliveries jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from trunk_deliveries where true;
  delete from trunk_branches where true;
  insert into trunk_regions (name)
    select distinct region from jsonb_populate_recordset(null::trunk_branches, p_branches) where region is not null
    on conflict do nothing;
  insert into trunk_branches (code, name, region, zone, notes)
    select code, name, region, zone, notes from jsonb_populate_recordset(null::trunk_branches, p_branches);
  insert into trunk_deliveries (ref_no, branch_code, delivered_on, trunk_type, old_trunks, trunks_received,
      stands_received, trunks_used, shifting_status, shifting_done_on, billing_tracked, invoice_no, invoice_date,
      invoice_amount, tax_rate, amount_received, payment_date, remarks)
    select ref_no, branch_code, delivered_on, trunk_type, old_trunks, trunks_received,
      stands_received, trunks_used, shifting_status, shifting_done_on, billing_tracked, invoice_no, invoice_date,
      invoice_amount, coalesce(tax_rate, 5.5), amount_received, payment_date, remarks
    from jsonb_populate_recordset(null::trunk_deliveries, p_deliveries);
end $$;
revoke execute on function trunk_replace_all(jsonb, jsonb) from public, anon, authenticated;
grant execute on function trunk_replace_all(jsonb, jsonb) to service_role;

-- Zones as a managed list, like regions. Safe to run more than once.
create table if not exists trunk_zones (
  name        text primary key,
  notes       text,
  created_at  timestamptz not null default now()
);
alter table trunk_zones enable row level security;

update trunk_branches set zone = nullif(trim(zone), '') where zone is distinct from nullif(trim(zone), '');
insert into trunk_zones (name)
  select distinct zone from trunk_branches where zone is not null
  on conflict do nothing;

-- Renaming a zone renames it on every branch; deleting it leaves those branches without a zone.
alter table trunk_branches drop constraint if exists trunk_branches_zone_fkey;
alter table trunk_branches add constraint trunk_branches_zone_fkey
  foreign key (zone) references trunk_zones(name) on update cascade on delete set null;

-- Import keeps managed regions and zones, adding any new ones found in the workbook.
create or replace function trunk_replace_all(p_branches jsonb, p_deliveries jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from trunk_deliveries where true;
  delete from trunk_branches where true;
  insert into trunk_regions (name)
    select distinct region from jsonb_populate_recordset(null::trunk_branches, p_branches) where region is not null
    on conflict do nothing;
  insert into trunk_zones (name)
    select distinct zone from jsonb_populate_recordset(null::trunk_branches, p_branches) where zone is not null
    on conflict do nothing;
  insert into trunk_branches (code, name, region, zone, notes)
    select code, name, region, zone, notes from jsonb_populate_recordset(null::trunk_branches, p_branches);
  insert into trunk_deliveries (ref_no, branch_code, delivered_on, trunk_type, old_trunks, trunks_received,
      stands_received, trunks_used, shifting_status, shifting_done_on, billing_tracked, invoice_no, invoice_date,
      invoice_amount, tax_rate, amount_received, payment_date, remarks)
    select ref_no, branch_code, delivered_on, trunk_type, old_trunks, trunks_received,
      stands_received, trunks_used, shifting_status, shifting_done_on, billing_tracked, invoice_no, invoice_date,
      invoice_amount, coalesce(tax_rate, 5.5), amount_received, payment_date, remarks
    from jsonb_populate_recordset(null::trunk_deliveries, p_deliveries);
end $$;
revoke execute on function trunk_replace_all(jsonb, jsonb) from public, anon, authenticated;
grant execute on function trunk_replace_all(jsonb, jsonb) to service_role;
