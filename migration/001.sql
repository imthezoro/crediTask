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