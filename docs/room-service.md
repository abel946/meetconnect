# MeetConnect Room Service

## Components
- Customer app: Room Service replaces the Messaging destination; hotel and private-room listings are read from `approved_room_listings`.
- Room Service partner app: `apps/room-service-employee`; separate account type and workspace for hotels/private-room owners.
- Existing Employee app: unchanged.
- Existing Admin app: includes provider and room-listing review panels.

## Supabase
The shared MeetConnect project now has:
- `room_service_username_registry`
- `room_service_profiles` (private provider/contact details and approval status)
- `room_service_public_profiles` (privacy-safe provider card fields)
- `room_listings`
- `room_bookings`
- `approved_room_listings` view
- `create_room_booking` RPC, which validates customer age, listing approval, guest limits, date ranges, and overlapping reservations.
- `room-service-media` Storage bucket for provider room photos.

Room provider accounts are created through the `room-service-username-auth` Edge Function. Admin approval is performed from the existing MeetConnect Admin dashboard.

## Important implementation status
Room listing discovery and reservation-request creation are connected to Supabase. Chapa checkout/webhook settlement is not yet wired for room bookings; bookings are currently unpaid reservation requests and must not be treated as paid/confirmed until payment verification is implemented. Customer-side reservation history and full availability calendar are also follow-up work.
