# MeetConnect shared backend setup

## Pricing policy
Each employee sets their own short and long session prices. Current values in the customer preview are examples only. MeetConnect's commission is fixed at **10% of a successfully paid session**; the employee share is 90% before Chapa/payment-provider fees and applicable taxes. The agreed price is stored on each connection request so later price changes do not change existing requests.

## Connect all three apps
All three Vercel projects must use the same Supabase project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (publishable/anon key only; never expose a service-role key in browser code)

1. Run `supabase/migrations/20261028_meetconnect_shared.sql` in the Supabase SQL Editor.
2. Add the two VITE_ variables to the user, employee, and admin Vercel projects, all pointing to the same Supabase project.
3. Implement/enable secure sign-in and connect all three frontends to the shared tables. Phone-only signup remains a prototype until this is done.
4. Create a trusted admin identity and perform approvals through a server-side function or securely assigned admin role. Do not allow public clients to approve employee profiles.
5. Implement Chapa checkout creation and verify payment webhooks before marking payments paid or releasing employee payouts.

## Security status
This migration defines shared tables and an RLS baseline; it does not mean the live database has already been migrated or the apps are live-connected. Payment records must only be written by a trusted server/webhook. Test signup, employee price publishing, admin approval, discovery visibility, requests, and payments end-to-end before launch.
