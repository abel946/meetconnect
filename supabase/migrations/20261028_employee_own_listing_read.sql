-- Allow an employee to view their own listing while it is pending or rejected.
-- Public discovery remains restricted to approved listings through approved_employee_cards.
alter table public.employee_profiles enable row level security;

drop policy if exists "employee can read own listing" on public.employee_profiles;
create policy "employee can read own listing"
  on public.employee_profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Keep employee self-service updates limited to pending listings.
-- Approval/status changes must be performed by a trusted server/admin path.
drop policy if exists "employee can update pending listing" on public.employee_profiles;
create policy "employee can update pending listing"
  on public.employee_profiles
  for update
  to authenticated
  using (auth.uid() = id and status = 'pending')
  with check (auth.uid() = id and status = 'pending');
