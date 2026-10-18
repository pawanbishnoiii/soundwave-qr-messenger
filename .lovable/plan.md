# Bnoy courier platform upgrade

## Already completed
- Google Maps Platform is connected with managed credentials.
- Existing features have been reviewed: login policy hooks, warehouse bags, shipment updates, dashboard preview, partner exchange and webhook processing.

## 1. Admin controls and rider visuals
- Add a dedicated **Login & maps** admin screen with OTP-only, password-only and both login modes, plus required/optional email. Enforce the rules in the sign-in functions as well as on screen; prompt existing accounts for missing required information.
- Use the connected Google Maps browser credentials by default. Allow an admin to select their own referrer-restricted browser key or OpenStreetMap; private server credentials remain securely stored, never in public settings.
- Keep only the existing clay PNG in the rider experience. Remove the store-pickup and cash-handover photographs from displayed screens without deleting assets.
- Improve the existing dashboard selector into an explicitly read-only user preview, including rider and warehouse views. Keep the admin identity and permissions unchanged; preview controls cannot perform actions as another user.

## 2. Compulsory location and tracking
- Require every signed-in user to enable location before entering operational screens. Explain denied permission, disabled device location and timeouts with a retry action; sign-out remains available.
- Browsers cannot turn GPS on themselves. A user who refuses permission remains blocked from operational work.
- Require a fresh valid GPS fix for staff scans, store receiving, bag scans, delivery and handover confirmation. Save coordinates, capture time, accuracy and actor on each scan record.
- Add on-duty rider location updates while the app is open, with a visible tracking state and timestamp. No promise of background tracking after the app is closed.
- Operational maps show authorized live updates. Customer tracking remains OTP-protected and shipment-scoped, not a public feed of staff locations. Distinguish last scan location from live rider position.

## 3. Warehouse label photos and hands-free bags
- Add label-photo upload/capture using local OCR and QR/barcode decoding, **without generative AI**. Display extracted tracking reference, destination text and pincode for review.
- Recommend the destination using the existing parcel record first, then configured hub/pincode rules. Unreadable or ambiguous labels require confirmation; never fabricate a tracking number or address.
- Support continuous camera and hardware-scanner input into the selected open bag, with success/error feedback, duplicate suppression, serialized processing and automatic focus restoration.
- Validate destination compatibility, sealed-bag state and parcel eligibility on the server. Save GPS for every accepted scan; rejected scans never count as received.

## 4. Franchise bulk receiving and partner records
- Research more than 30 distinct websites, prioritizing courier documentation and handover standards, and retain a source list with specific findings.
- Introduce incoming manifests containing expected parcels, bag reference/seal and sending/receiving staff or branch. Reconcile scanned, missing, extra and damaged parcels before completion.
- Separate **custody handover verification** from each customer's delivery OTP. Use one receiving confirmation for a manifest, not an artificial delivery OTP on every warehouse parcel.
- Confirm authorized receiving staff, counts and discrepancies; produce a branded digital receipt with timestamps, GPS and parcel events.
- Connect manifest imports to the existing authenticated partner order/API exchange. Preserve provider-specific signature verification and idempotent event handling; do not claim live Shiprocket/Delhivery integration without partner credentials.

## 5. Demo data, automation and database protections
- Seed at least **120 realistic demo parcels** in one operation, with coherent destinations, service/payment modes and status histories, plus distributors, managers, riders and warehouse staff.
- Make repeated seeding safe and clearly identifiable as demo data. Do not ship fixed passwords or universal OTP bypasses.
- Add only additive database changes for scan logs, manifest reconciliation, receiving receipts and authorized location records. Include grants, role-based policies and server-side validation.
- Use triggers for transactional parcel side effects and event-driven partner/webhook processing. Audit the existing outbox and add bounded retry scheduling only while work exists, rather than a permanently running frequent sweeper.
- Add a daily cleanup/reconciliation job where time-based work is necessary; show its actual results in the admin jobs screen. No fabricated partner updates or automatic parcel delivery.

## 6. Landing page
- Place **One barcode · six handovers** immediately after **One workspace. Every handover.** Remove the intervening image-card block, highlights band and operations reel from that position.
- Refine scoped GSAP transitions, eliminate competing hero movement, clean up event listeners and respect reduced motion. Keep the hero subject visible across screen sizes.

## Verification and limits
- Test concrete rules: login modes, email requirement, valid GPS, duplicate bag scans, destination matching, receiving reconciliation, preview authorization and minimum demo count.
- Run migration safety checks and relevant tests; inspect the automatic build results.
- Test signed-in workflows for every existing role: admin, distributor, manager, rider and warehouse. The current platform has no separate super-admin role; do not invent new privileges.
- Exercise seed → assignment → bag/manifest receiving → rider bucket → OTP delivery → cash handover, including denied-location and unauthorized-action states.
- Google Maps live testing is unavailable in the agent sandbox. Keep the integration and check its code/build; final rendering needs user validation on an authorized deployed origin.
- Real SMS delivery, external partner synchronization and external notifications are verified only when configured services successfully respond. Missing provider credentials will be named, not replaced with pretend success.

## Technical approach
- Keep TanStack Start routes and authenticated server functions, existing role hierarchy/RLS, and generated Cloud clients.
- Share GPS acquisition/validation and deterministic label/destination rules across all scan entry points.
- Load OCR and browser-only maps after hydration; server APIs use the connected authenticated Google Maps gateway, with bounded inputs and caching.
- Use private storage/access policies for retained label photos. Do not broaden anonymous shipment access for tracking.