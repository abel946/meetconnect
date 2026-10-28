# MeetConnect deployment and authentication handoff

## What has been verified
- The GitHub repository is `abel946/meetconnect`.
- Vercel has projects named `meetconnect`, `meetconnect-employee`, and `meetconnect-admin`.
- The employee and admin projects have existing deployments marked READY.
- The customer app's current registration flow is explicitly a local-device preview, not a Supabase account. It must not be described as real login.
- A new deployment attempt from the GitHub source failed with Vercel error `git_info_fail`. Creating/relinking projects also returned: "You need to add a Login Connection to your GitHub account first."

## Required one-time account action
In Vercel, open Account Settings → Authentication / Login Connections (wording may vary) and connect the GitHub account that owns `abel946/meetconnect`. Then verify that Vercel is authorized to access this repository. This is an account-level authorization that cannot be completed by editing repository code.

After GitHub is connected, redeploy the latest `main` commit to the `meetconnect` project. Configure the employee project root directory as `apps/employee` and the admin project root directory as `apps/admin`. Each Vite app should use `npm install`, `npm run build`, and output directory `dist`.

## Supabase prerequisites
- Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured on all three Vercel projects as needed.
- Apply the SQL migrations in `supabase/migrations` using the Supabase SQL Editor, in filename order.
- Configure the chosen authentication provider and redirect/allowed URLs for the production and preview domains.
- Never place a Supabase service-role key in a browser-exposed `VITE_*` variable.
- Test sign-up, verification, sign-in, sign-out, password recovery, and row-level security with test accounts before using real user data.

## Important current limitation
The employee portal and admin console are prototypes. Employee price fields and admin approve/reject actions currently change local UI state only. Do not use them to approve real users or handle real payments until server-side authorization and database persistence are implemented and tested.
