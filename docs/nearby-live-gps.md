# MeetConnect Nearby Live GPS

## Current implementation

- The MeetConnect Supabase project has a private `employee_live_locations` table with RLS enabled.
- Approved adult employees can create/update/read only their own location row.
- Direct location-table reads are not granted to customers or anonymous users.
- `nearby_available_employees(latitude, longitude, radius_m)` returns only approved, adult, opposite-gender employees who opted into sharing and are fresh (last update within 45 seconds). The default radius is 5 km and the server caps it at 20 km. Discovery coordinates are rounded to 3 decimal places.
- `active_connection_employee_location(request_id)` returns exact coordinates only to the customer or employee on that accepted request, while location sharing is enabled and the location is fresh (within 90 seconds).
- Employee portal includes an explicit Go Online / Go Offline GPS control. It uses browser geolocation and writes an update at most every 4 seconds while the portal is active.

## Important rollout boundaries

- The customer map and nearby discovery UI are not yet connected to the RPCs.
- Google Maps SDK/API key is required before enabling Google road maps, directions and ETA.
- Browser geolocation is foreground-only and may pause when Android suspends the browser/app. Production background tracking requires an Android foreground location service, visible persistent notification, and runtime permission flow.
- No location history is collected in this phase. Stale locations are excluded from discovery; a retention cleanup policy should be added before production.
- Do not expose raw employee coordinates in public profile cards or admin/public APIs.
