-- Manual RLS verification for public.jobs.
-- Proves a user can read/write only their own rows BEFORE any real data exists.
--
-- Run against the local stack:
--   supabase start
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls_jobs_verify.sql
--
-- Expected: the two SELECTs at the end each return exactly 1 row (each user sees
-- only their own), and the cross-user UPDATE affects 0 rows. Any deviation = RLS hole.

begin;

-- Seed two fake auth users (normally created by Supabase Auth).
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com')
on conflict (id) do nothing;

-- Act as Alice and insert a row.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.jobs (user_id, company_name, job_title, source_url)
values (auth.uid(), 'Acme', 'Engineer', 'https://example.com/jobs/alice-1');

-- Alice should see exactly her 1 row.
select 'alice_sees' as check, count(*) as rows from public.jobs;

-- Switch to Bob.
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

insert into public.jobs (user_id, company_name, job_title, source_url)
values (auth.uid(), 'Globex', 'Analyst', 'https://example.com/jobs/bob-1');

-- Bob should see exactly his 1 row (NOT Alice's).
select 'bob_sees' as check, count(*) as rows from public.jobs;

-- Bob attempts to modify Alice's rows → must affect 0 rows.
with updated as (
  update public.jobs set company_name = 'HACKED'
  where company_name = 'Acme'
  returning 1
)
select 'bob_cross_user_update_rows' as check, count(*) as rows from updated;

rollback;
