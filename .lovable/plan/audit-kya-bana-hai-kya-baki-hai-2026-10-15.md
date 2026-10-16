# Audit: kya bana hai, kya baki hai

Note: Upload sirf text file thi — usme koi image nahi thi. Images chahiye to dobara attach karein.

## Ban chuka hai (verified files)
- Landing page redesign (GSAP headline, route line, parcel journey), track page
- Login/signup with demo OTP 1234 (email + phone), Google login
- Dashboard, Shipments, Scan (camera + sound), Lots, Returns (photos + live location), Team hierarchy
- Courier partners, API keys, signed webhooks (admin only)
- Single QR/barcode label print

## Baki hai (missing)
1. Rider mobile app view — app jaisa dashboard: aaj ke orders, pending, delivered, wallet, rating, accuracy
2. Phone number se login (abhi sirf signup pe phone; login email se)
3. Cancel flow — rider customer ko call kare, customer ka OTP (1234) lekar hi cancel
4. Rider wallet — har delivery/return pe Rs 15 automatic, cancel pe nahi; history
5. Rating system — har rider ki rating save + daily delivery accuracy
6. Admin/Super-admin dashboard — rider leaderboard, wallet payouts, COD summary, role-wise options check
7. API docs page + B2B API docs page (Delhivery B2B style order creation fields)
8. Bill/invoice print for API orders
9. Barcode sheet print — A4 par multiple labels, custom size/layout
10. Real Shiprocket/Ekart/Delhivery sync — credentials chahiye (blocked)

## Order of build
Phase 1: Wallet + ratings + cancel-OTP (database + rider screens)
Phase 2: Rider mobile app dashboard + phone login
Phase 3: Admin dashboard upgrade + role options audit
Phase 4: API docs, B2B docs, invoice print, barcode sheet
Phase 5: Full test sab roles ke saath, phone + desktop

## Technical details
- New tables: rider_wallet_txns, rider_ratings; trigger on shipments/returns status → credit Rs 15 (idempotent per shipment)
- cancel_with_otp RPC; customer phone shown to assigned rider only
- Phone login: synthetic email from phone number, demo OTP
- Print: CSS @page sheets via labels.ts
