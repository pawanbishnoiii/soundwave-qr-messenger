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
- [ ] Per-role dashboards + admin "view as" switcher
- [ ] Hero/background images + GSAP polish across dashboards, onboarding redesign
- [ ] End-to-end browser test — needs a first signed-up account
