create table if not exists public.meetconnect_admin_password_credentials (
  username text primary key check (username = 'CEO'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  password_salt text not null,
  password_hash text not null,
  password_set_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meetconnect_admin_password_credentials enable row level security;
revoke all on public.meetconnect_admin_password_credentials from public, anon, authenticated;
grant all on public.meetconnect_admin_password_credentials to service_role;

create table if not exists public.meetconnect_admin_password_attempts (
  client_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);
alter table public.meetconnect_admin_password_attempts enable row level security;
revoke all on public.meetconnect_admin_password_attempts from public, anon, authenticated;
grant all on public.meetconnect_admin_password_attempts to service_role;
