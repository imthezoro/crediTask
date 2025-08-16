create table user_profiles (
  id uuid primary key references auth.users(id),
  plan text default 'free',
  usage_count int default 0,
  created_at timestamptz default now()
);

create table prompt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  original_prompt text,
  enhanced_prompt text,
  site text,
  created_at timestamptz default now()
);

-- RLS
alter table public.prompt_sessions enable row level security;
create policy "user can insert own sessions"
  on public.prompt_sessions for insert
  with check (auth.uid() = user_id);
create policy "user can read own sessions"
  on public.prompt_sessions for select
  using (auth.uid() = user_id);

alter table public.user_profiles enable row level security;
