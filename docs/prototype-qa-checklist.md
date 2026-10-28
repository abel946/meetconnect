# MeetConnect prototype QA checklist

Use this checklist before showing the three interfaces to an investor or tester. The current deployment is a **frontend prototype**, not a production service.

## Customer app
- [ ] Open the customer preview on a phone-sized screen.
- [ ] Confirm the 18+ checkbox is required before continuing.
- [ ] Try continuing with an empty name and an invalid phone number; confirm a helpful message appears.
- [ ] Create a demo profile with a test name and phone number.
- [ ] Confirm a woman profile shows only male employee demo cards and a man profile shows only female employee demo cards.
- [ ] Confirm Discover, Connections, Messages, and Profile navigation works.
- [ ] Send a demo connection request and confirm it appears in Connections.
- [ ] Confirm the map is labelled/understood as an approximate illustrative area, not live GPS.
- [ ] Test report/block controls and make sure they are described as demo-only until backend workflows exist.

## Employee portal
- [ ] Open the employee preview.
- [ ] Change short and long prices to positive amounts and save.
- [ ] Confirm 10% commission and 90% employee share calculations update.
- [ ] Confirm invalid/zero prices are rejected.
- [ ] Verify profile fields and file inputs are visibly marked as preview-only until secure uploads and database persistence exist.

## Admin console
- [ ] Open the admin preview.
- [ ] Search profiles and change the status filter.
- [ ] Try the demo approve/reject controls.
- [ ] Confirm the interface clearly says these actions are local demo changes and cannot moderate real accounts.

## Required before public launch
- [ ] Apply the shared Supabase migration and confirm row-level security policies in the actual project.
- [ ] Implement real sign-in and server-verified 18+ eligibility; a browser checkbox alone is not age verification.
- [ ] Implement role-based employee/admin authorization. Never trust a role supplied by browser state.
- [ ] Persist employee profiles, prices, requests, messages, blocks, and reports through protected database policies.
- [ ] Add secure photo/video storage policies and file-size/type limits.
- [ ] Implement Chapa checkout creation and signed/verified payment webhooks on a trusted server.
- [ ] Test registration, email/phone verification, account recovery, discovery, approvals, requests, reporting, and payments end-to-end.
- [ ] Review privacy, consent, moderation, data retention, and applicable Ethiopian legal requirements.

## Current prototype limits
Customer signup and requests use browser local storage when the demo flow is used. The employee portal's price/profile fields and admin review actions are also demo-only. Do not collect real sensitive data or use demo approval controls for real users.
