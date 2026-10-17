# Big upgrade: rider app, warehouse, payments, emails, planner, landing and tracking

No API keys are needed to build this. Anything that depends on an outside provider (SMS, email server, Razorpay/Stripe/Paytm) works fully once the admin pastes keys in the Gateways screen, and shows a clear "not connected" state until then.

## Phase 1 - Roles cleanup and audit
- One admin role only (admin = super admin). Remove any "super admin" wording.
- Add a new **Warehouse** role. Admin can add warehouse staff from the Team page.
- Review every page per role and give each role only the pages it really needs:
  - Admin: everything, plus view-as any role.
  - Distributor / Manager: their team, parcels, lots, routes, cash, stop planner.
  - Rider: only the rider app (no desktop menu).
  - Warehouse: sorting, packing, bags/boxes, stock.
- Remove or merge low-value pages (Hub network vs Hubs and branches, duplicate menu items).

## Phase 2 - Rider app (separate phone app look)
- Its own layout, colours, font and theme, completely different from the main site; phone first, still usable on desktop.
- Bottom tabs: Today, Scan, Route, Wallet, Profile.
- Today: greeting header, quick tiles (to deliver, delivered, failed, cash in hand, rating), next stop card.
- Scan: camera opens, reads barcode or QR, plays sound, camera closes and the parcel card slides up instantly with actions (call, navigate, deliver with OTP, failed with reason, cancel with OTP).
- Route: stop list in the order the manager applied, map links, swipe-style cards.
- Wallet: earnings, history, cash handover button.
- Rule: a parcel can never be marked returned before it has gone out for delivery (enforced in the database too).
- New generated illustrations for empty states and onboarding.

## Phase 3 - Stop-order planner (no AI)
- Manager picks a rider and adds limits (start time, max weight, max stops, priority to cash/express).
- Rule-based ordering by pincode cluster, deadline, express, reattempts.
- Risk flags: high cash, repeat attempts, late deadline, far-off pincode, overweight.
- "Apply" saves the order to the rider's Route tab.
- The existing AI route planner stays admin only.

## Phase 4 - Warehouse
- Pages: Inbound, Sorting, Packing, Bags and boxes, Products, Locations.
- Add products (name, SKU, weight, quantity).
- Create a bag or box for a destination; scan multiple products or parcels into it, grouped by location/pincode.
- Seal the bag, print a branded barcode bag label, dispatch to a hub.

## Phase 5 - Customer payment page
- Public pay link per parcel (from parcel page and tracking page) with amount due.
- Choose Razorpay, Stripe or Paytm (only the ones the admin enabled).
- Payment confirmed on the server, saved against the parcel, receipt page shown, parcel marked paid.

## Phase 6 - Emails
- Send queued emails (dispatched, out for delivery, delivered, failed, welcome) through the admin's mail settings using an email sending service that works on this hosting.
- Admin screen: email list with status, "Send now", retry, test email.
- Automatic sending every few minutes.

## Phase 7 - Landing and tracking pages
- Landing: new generated images, stronger GSAP hero, scroll scenes, real icons, cleaner sections.
- Tracking: modern timeline, live status map strip, delivery promise, pay-now button, OTP gate kept.

## Phase 8 - Libraries and polish
Install and use 20+ libraries where they add value, e.g. framer-motion, gsap plugins, lenis (smooth scroll), vaul (bottom sheets), embla carousel, recharts, react-leaflet, @zxing/browser (faster barcode scan), date-fns, react-hook-form, zod, canvas-confetti, sonner, cmdk, react-countup, lottie-react, jsbarcode, qrcode, react-to-print, @tanstack/react-table, react-virtuoso, howler, clsx, a new font pair.

## Phase 9 - Testing
Sign in as each role (admin, distributor, manager, rider, warehouse), run the main flows on phone and desktop sizes, fix what breaks.

## Technical details
- Database: add `warehouse` to roles; new tables for products, warehouse locations, bags, bag items; `route_seq` used for applied stop order; trigger blocking return before out_for_delivery; payment verify functions per gateway; email sending via a server route called on a schedule.
- Payment and email secrets stay server-side; settings editable by admin in Gateways.
- All new tables with grants plus row-level security; warehouse rows visible to admin and warehouse staff only.
- Migrations pass the existing migration safety check.

Note: this is very large, so it will be built across several turns, phase by phase, starting with Phases 1-3.
