alter table public.user_profiles
    alter column plan set not null,
    alter column usage_count set not null,
    add column if not exists plan_valid_until timestamptz default null,
    add column if not exists updated_at timestamptz not null default now();





alter table public.prompt_sessions
    alter column user_id set not null,
    alter column original_prompt set not null,
    drop column if exists enhanced_prompt,
    add column if not exists base_enhanced_prompt text not null default '',
    add column if not exists nested_options jsonb not null default '{}'::jsonb,
    add column if not exists final_prompt text;

