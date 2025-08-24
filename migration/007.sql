-- Public signups table (MVP) replacing previous interest_signups
create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  email text not null,
  expected_usage text,
  feedback text,
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

-- Keep RLS ON; allow anonymous and authenticated inserts so anyone can submit feedback
alter table public.signups enable row level security;

create policy "anon can insert signups" on public.signups
  for insert
  to anon
  with check (true);

create policy "authenticated can insert signups" on public.signups
  for insert
  to authenticated
  with check (true);

-- Optional: enable public read if desired (kept disabled by default)
-- create policy if not exists "anon can read signups" on public.signups for select to anon using (true);
-- create policy if not exists "authenticated can read signups" on public.signups for select to authenticated using (true);

-- Optionally allow authenticated users to read their own email rows if needed later
-- For now, keep read closed (no select policy). Uncomment below if you want users to view entries.
-- create policy if not exists "authenticated can read interest" on public.interest_signups
--   for select
--   to authenticated
--   using (true);
