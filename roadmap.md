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
