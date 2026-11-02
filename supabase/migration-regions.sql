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
