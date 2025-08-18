
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  provider text not null,             -- 'stripe' | 'razorpay'
  provider_payment_id text not null,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null,               -- 'pending' | 'succeeded' | 'failed' | 'refunded'
  plan text not null,                 -- e.g. 'pro_weekly'
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  created_at timestamptz not null default now()
);


-- ============================
-- RLS: user_profiles
-- ============================
alter table public.user_profiles enable row level security;

create policy "user can read own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

create policy "user can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================
-- RLS: prompt_sessions
-- ============================
alter table public.prompt_sessions enable row level security;
-- Already existing RLS
-- create policy "user can insert own sessions"
--   on public.prompt_sessions
--   for insert
--   with check (auth.uid() = user_id);

-- create policy "user can read own sessions"
--   on public.prompt_sessions
--   for select
--   using (auth.uid() = user_id);

-- ============================
-- RLS: payments
-- ============================
alter table public.payments enable row level security;

create policy "user can read own payments"
  on public.payments
  for select
  using (auth.uid() = user_id);

-- ============================
-- TRIGGER: auto create user_profile
-- ============================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, plan, usage_count)
  values (new.id, 'free', 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();