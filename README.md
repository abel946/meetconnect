# MeetConnect

An Ethiopia-first social discovery MVP for consenting adults aged 18+.

## Separate applications

- **Customer app (repository root):** the approved compact, animated user experience, including age gate, discovery preferences, map-style meeting-area preview, and safety UI.
- **Employee portal (`apps/employee`):** separate mobile-friendly employee workspace, service request preview, employee profile fields, optional photo/video upload controls, and pricing display (SHORT 500 ETB / LONG 2,000 ETB).
- **Admin console (`apps/admin`):** separate responsive interface for user/employee review, search/filter, and demo approval/rejection actions.

## Deployment previews

The employee portal and admin console were deployed as static preview snapshots. They are **not yet wired to live authentication or a database**, and the static preview copies are not automatically updated from GitHub until the GitHub-Vercel connection is configured.

## Before production

Authentication, employee approval persistence, role-based admin access, secure file uploads, database/RLS policies, reporting/blocking workflows, privacy-safe location handling, and Chapa payments must be implemented and tested. Never use the demo approval controls to moderate real accounts.


## Customer app progress (2026-10-28)

The customer app now has a phone-only onboarding preview: 18+ confirmation, name, phone number, and gender. It does not ask for email, Fayda ID, or SMS verification in this prototype. The selected signup gender filters the demo employee profiles so men see women employees and women see men employees. The approved compact animated design and Bole/Kazanchis approximate-area map preview are preserved. Customer navigation now includes Discover, Connections, Messages, and Profile; the demo connection requests are stored locally in the browser.

Preview deployment: https://meetconnect-ehb2ay2lt-abemelekbekele375-5949.vercel.app

**Important:** This is still a frontend prototype. Signup details and requests are stored only in the browser and are not secure server accounts. Employee profiles are sample records, the map is illustrative (not a live GPS/map service), and connection, messaging, report/block, moderation, and payments need secure backend implementation before public launch.
