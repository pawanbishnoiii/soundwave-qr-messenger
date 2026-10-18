# Bnoy Logistics upgrade

## Completed
- [x] Landing page, fonts, GSAP, tracking, mobile layouts
- [x] 11 logistics photos, courier partners, API keys, signed webhooks
- [x] Phone + demo OTP signup, returns/cancellations, rider wallet, ratings
- [x] Team page: search, role filters, parcel counts, hierarchy tree
- [x] AI issue assist, corridor analytics, abort-safe error handling

## Current sprint (Oct 15)
- [ ] Pay & bonuses admin-only (nav gate + RLS) — rider/manager hidden
- [ ] Hubs: real India map, clickable Delhi/Mumbai/Bengaluru/Indore with on-time % + breach alerts
- [ ] Backend jobs: verify/upgrade cron + webhook outbox processing
- [ ] End-to-end test parcel: create → pickup → scan → OTP delivery → return (admin + rider)
- [ ] Landing page: Shiprocket/Delhivery-inspired professional redesign + new images
- [ ] Vercel deploy: document required env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

## Blocked on external accounts
- Real SMS OTP — needs SMS provider account
- Live Shiprocket/Delhivery/Ekart sync — needs partner credentials

## Oct 16 request
- [x] Fix publish crash ("This page didn't load")
- [x] Fix return request error (return types)
- [x] Cash handover screen (rider/manager/admin + append-only ledger)
- [x] Hubs, fleet, merchants, routes pages + menu links
- [x] AI failed-delivery recovery uses full history + failure notes
- [x] AI route planner for dispatchers
- [x] Migration safety check (`bun run check:migrations`)
- [ ] Phone-only signup/login without placeholder email — needs SMS provider (Twilio/MSG91)
- [ ] SMTP (Hostinger/custom) automatic emails — needs SMTP host/user/password
- [x] Per-role dashboards + admin "view as" switcher
- [x] New hero photo, parallax, sign-in panel refresh
- [ ] End-to-end browser test — needs a first signed-up account

## Oct 16 (2)
- [x] AI tools admin-only; parcel filters (tracking/status/hub/rider)
- [x] Admin setup wizard; phone-only profiles (no placeholder email saved)
- [x] Rider app redesign; new hero photo; OTP-verified /track, public tracking API removed
- [ ] Real SMS for OTPs — needs SMS provider

## Oct 17 big upgrade (plan approved)
- [x] Separate phone-first rider app (/rider): own theme/font, bottom tabs, instant scan → parcel sheet, camera closes
- [x] Returns blocked before a delivery attempt (database rule)
- [x] Rule-based stop planner with risk flags, applies order to rider route
- [ ] Warehouse role + sorting/packing/bags pages
- [ ] Customer payment page (Razorpay/Stripe/Paytm) + confirmation
- [ ] Email sending + admin "Send now"
- [ ] Landing + tracking page upgrade, role menu cleanup, more libraries
- [ ] Full role-by-role test

## Oct 18
- [x] Staff Cash page shows handover code for riders
- [x] Customer payment page /pay (Razorpay/Stripe/Paytm, test mode) + confirmation
- [x] Warehouse page: scan products, bags/boxes, scan parcels in, seal, dispatch, print bill
- [x] Tracking: free OpenStreetMap map + pay online button
- [x] Gmail SMTP defaults + provider/port/security options
- [x] Landing: pinned horizontal scroll reel, letter animation, magnetic buttons; replaced 2 branded photos
- [ ] Deeper rider app redesign, admin parcel lookup by customer phone/location, full signed-in role test

## Remix setup (Oct 18)
- [x] Update SMTP_APP_PASSWORD through the secure form
- [x] Clear copied migration files and scaffold an empty baseline without changing application tables or data

## Courier platform expansion (Oct 18)
- [x] Connect Google Maps Platform
- [ ] Research 31+ websites for franchise receiving and partner exchange practices
- [ ] Admin login/map rules, Google-first fallback, mandatory location and scan GPS
- [ ] Warehouse label-photo OCR without generative AI, destination rules, hands-free bags and bulk receipts
- [ ] Live tracking, secure admin user-dashboard preview, 100+ demo parcels and expanded team
- [ ] Rider clay-only imagery; landing section order and GSAP refinement
- [ ] Database automation/jobs and signed-in checks across every existing role
