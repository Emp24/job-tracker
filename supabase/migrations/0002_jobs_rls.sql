-- Phase 0: Row-Level Security for public.jobs.
-- Every operation is constrained to the owning user (user_id = auth.uid()).
-- Without this, any authenticated user could read everyone's data.
--
-- The parse Edge Function is expected to call Supabase with the *user's* JWT
-- (not the service_role key), so these policies apply to its writes too. The
-- INSERT WITH CHECK guarantees a row can never be created for another user.

alter table public.jobs enable row level security;
-- Belt-and-suspenders: reject anon/unauthenticated even if a permissive policy
-- is ever added later.
alter table public.jobs force row level security;

create policy "jobs_select_own"
  on public.jobs
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "jobs_insert_own"
  on public.jobs
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "jobs_update_own"
  on public.jobs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "jobs_delete_own"
  on public.jobs
  for delete
  to authenticated
  using (user_id = auth.uid());
