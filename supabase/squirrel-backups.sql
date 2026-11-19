create table public.squirrel_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  ledger jsonb not null check (jsonb_typeof(ledger) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table public.squirrel_backups enable row level security;
revoke all on public.squirrel_backups from public, anon, authenticated;
grant select, insert, update on public.squirrel_backups to authenticated;

create policy squirrel_read_own on public.squirrel_backups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy squirrel_insert_own on public.squirrel_backups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy squirrel_update_own on public.squirrel_backups
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
