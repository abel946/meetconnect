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
