create table if not exists public.meetconnect_admin_setup_tokens (
  token_hash text primary key,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.meetconnect_admin_setup_tokens enable row level security;
revoke all on public.meetconnect_admin_setup_tokens from public, anon, authenticated;
grant all on public.meetconnect_admin_setup_tokens to service_role;
