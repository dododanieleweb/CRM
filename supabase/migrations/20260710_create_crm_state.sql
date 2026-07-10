create table if not exists public.crm_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"darkMode": false, "crmClients": [], "socialItems": [], "adSlots": []}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_state enable row level security;
