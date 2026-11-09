-- Run in Supabase SQL Editor BEFORE publishing the new frontend.
-- Financial records are stored together in hisab_users.data, including _cash.
-- Do not execute this against MySQL. Back up both tables first.
begin;
create or replace function public.hisab_guard_revision() returns trigger
language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and coalesce((old.data::jsonb->>'_format')::int,0)>=3 then
    if coalesce((new.data::jsonb->>'_format')::int,0)<3
       or coalesce((new.data::jsonb->>'_revision')::bigint,0) <> coalesce((old.data::jsonb->>'_revision')::bigint,0)+1
       or not (new.data::jsonb ? '_cash') then
      raise exception 'Account changed or this app is outdated. Reload before saving.' using errcode='40001';
    end if;
  end if;
  new.updated_at=clock_timestamp();
  return new;
end; $$;
drop trigger if exists hisab_revision_guard on public.hisab_users;
create trigger hisab_revision_guard before insert or update on public.hisab_users
for each row execute function public.hisab_guard_revision();
-- These policies use the existing UUID id=auth.uid() ownership model.
-- Inspect existing ownership policies before changing RLS:
-- select tablename, policyname, cmd, qual, with_check from pg_policies
-- where schemaname='public' and tablename in ('hisab_users','hisab_cash');
-- hisab_users must permit SELECT, INSERT, UPDATE only where id=auth.uid().
-- hisab_cash remains read-only for this frontend after migration.
-- This script does not replace existing policies or disable access.
-- Existing policies must be reviewed: permissive policies combine with OR.
-- Do not blindly add policies alongside an unrestricted existing policy.
commit;
