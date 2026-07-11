do $$
begin
  create type public.crm_role as enum ('admin', 'commerciale', 'account', 'marketing');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.crm_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Team BASE',
  created_by uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.crm_teams(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.crm_role not null default 'commerciale',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.crm_state add column if not exists team_id uuid references public.crm_teams(id) on delete cascade;

-- Every existing authenticated user receives a personal team. New members are
-- subsequently added to the administrator's team from the BASE application.
insert into public.crm_teams (name, created_by)
select 'Team BASE', id from auth.users
on conflict (created_by) do nothing;

insert into public.team_members (team_id, user_id, role)
select id, created_by, 'admin'::public.crm_role from public.crm_teams
on conflict (team_id, user_id) do nothing;

update public.crm_state as state
set team_id = team.id
from public.crm_teams as team
where state.owner_id = team.created_by and state.team_id is null;

-- The previous version used owner_id as the primary key. CRM state is now
-- identified by its team, while owner_id remains only as legacy information.
alter table public.crm_state drop constraint if exists crm_state_pkey;
alter table public.crm_state alter column owner_id drop not null;

drop index if exists public.crm_state_one_row_per_team;

do $$
begin
  alter table public.crm_state add constraint crm_state_team_id_key unique (team_id);
exception
  when duplicate_object then null;
end $$;

alter table public.crm_teams enable row level security;
alter table public.team_members enable row level security;
