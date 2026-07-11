# Product Requirements Document (PRD)
## Krishnappa Shetty and Son's — Home Delivery App

**Version:** 1.0
**Date:** 11 July 2026
**Owner:** Shop proprietor (Admin)
**Status:** Approved for build

---

## 1. Product summary

A three-sided mobile application (Android + iOS) that lets customers of **Krishnappa Shetty and Son's**, a grocery/provisions (kirana) store, browse live inventory, place orders **by voice in Kannada, Hindi or English** or by tapping, pay by UPI (via the shop's own QR shown inside the app) or Cash on Delivery, and receive home delivery. The shop owner runs the entire business from an admin panel inside the same app: inventory, orders, customers, delivery assignment, invoices and daily reports. Delivery staff get a stripped-down app to see assigned orders, navigate, collect cash and mark deliveries complete.

**One-line pitch:** The kirana shop your grandmother orders from — now she can just talk to it.

---

## 2. Problem statement

| Problem | Who feels it | Today's workaround |
|---|---|---|
| Phone orders are misheard, forgotten, or written on paper slips | Owner | WhatsApp voice notes + notebook |
| Customer doesn't know what's in stock or what it costs | Customer | Calls the shop and asks |
| Older / less literate customers can't use typed apps in English | Customer | Doesn't order at all; walks to shop |
| No record of who owes money, what was delivered, what's low in stock | Owner | Memory and a ledger |
| Delivery boy doesn't know the route, the amount to collect, or which order is which | Delivery staff | Owner calls him repeatedly |
| Big apps (Blinkit, Zepto) take commission and own the customer | Owner | — |

**Core insight:** The shop's competitive advantage is *relationship and trust*, not speed. The app must not feel like a quick-commerce clone. It must feel like calling the shop, except it works.

---

## 3. Goals and non-goals

### 3.1 Product goals
- **G1** — A customer can place a complete order using only their voice, in their own language, in under 60 seconds.
- **G2** — The owner can run the shop end-to-end from the phone: no separate desktop, no paper ledger.
- **G3** — Payment works with the shop's *existing* UPI QR — no new merchant account, no payment gateway fees on day one.
- **G4** — Inventory shown to the customer is always the real inventory. No orders for items that don't exist.
- **G5** — Every delivered order produces an invoice, automatically.

### 3.2 Success metrics (first 90 days after launch)

| Metric | Target |
|---|---|
| Registered customers | 150 |
| Orders placed per week | 60 |
| % of orders placed via voice | ≥ 35% |
| Voice order accuracy (items correct without manual editing) | ≥ 85% |
| Median time from order placed → delivered | ≤ 90 minutes |
| Orders cancelled due to out-of-stock | < 5% |
| Owner time spent on order paperwork per day | < 15 min (from ~60 min) |

### 3.3 Non-goals (explicitly out of scope for v1)
- ❌ Multi-store / franchise support (single shop only)
- ❌ Marketplace with third-party sellers
- ❌ Loyalty points, referrals, gamification
- ❌ Live delivery-boy tracking on a map *for the customer* (owner sees it; customer sees status only) — deferred to v1.1
- ❌ GST filing / accounting software export (invoice PDF only)
- ❌ Web storefront
- ❌ Automated UPI payment reconciliation via a payment gateway (see §7.3 — deliberate phase-2 decision)
- ❌ Subscriptions / recurring monthly grocery lists (strong v1.1 candidate)

---

## 4. Users and roles

### 4.1 Persona A — Owner / Admin ("Krishnappa" or his son)
- Age 35–60, uses WhatsApp fluently, comfortable in Kannada, reads English numbers/prices.
- Has one phone. Uses it while standing behind the counter, often one-handed.
- Needs: see new orders *loudly and immediately*, confirm stock, assign a delivery boy, know today's cash collected.
- Pain if we get it wrong: he goes back to the notebook and the app dies.

### 4.2 Persona B — Delivery staff ("delivery boy")
- Age 18–30, Android phone, patchy 4G, rides a two-wheeler.
- Needs: what to pick up, where to go, how much cash to collect, one-tap navigation, one-tap "delivered".
- Must work when the network drops mid-ride.

### 4.3 Persona C — Customer
Three sub-types, all supported by the same app:
- **C1 — The regular (40+, Kannada-first).** Wants to say "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಮತ್ತು ಒಂದು ಲೀಟರ್ ಎಣ್ಣೆ" and be done. Voice is *the* feature for her.
- **C2 — The young household (25–40, bilingual).** Browses categories, taps, pays UPI. Compares prices to Blinkit.
- **C3 — The bulk buyer (monthly ration).** Large order, wants an invoice, pays UPI.

### 4.4 Role permission matrix

| Capability | Customer | Delivery | Admin |
|---|:--:|:--:|:--:|
| Browse catalogue & stock | ✅ | — | ✅ |
| Place order (voice or manual) | ✅ | — | ✅ (on behalf of a phone customer) |
| View own orders | ✅ | — | ✅ (all) |
| View assigned orders | — | ✅ | ✅ |
| Update order status | — | ✅ (only assigned, only forward) | ✅ (any) |
| Mark payment received | — | ✅ (COD cash collected) | ✅ |
| Verify UPI payment | — | — | ✅ |
| Edit products / prices / stock | — | — | ✅ |
| Add/remove staff | — | — | ✅ |
| View reports & invoices | own invoices | — | ✅ |
| Edit shop settings (QR, hours, delivery fee) | — | — | ✅ |

---

## 5. Feature requirements

Priority: **P0** = must ship in v1 (app is broken without it). **P1** = ship in v1 if time allows. **P2** = v1.1.

### 5.1 Authentication & onboarding

| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | Sign up / log in with **Indian mobile number + OTP**. No email, no password. | P0 |
| AUTH-2 | On first login, customer enters name and delivery address (with a "use my location" pin). | P0 |
| AUTH-3 | Role is assigned server-side. A user is `customer` by default. Only the Admin can promote a number to `delivery` or `admin`. | P0 |
| AUTH-4 | Language selection on first launch: **ಕನ್ನಡ / हिन्दी / English**, changeable later in settings. Entire UI translates. | P0 |
| AUTH-5 | Session persists; user stays logged in until they explicitly log out. | P0 |
| AUTH-6 | The delivery staff and admin see a completely different home screen after login (role-based routing). | P0 |

### 5.2 Catalogue & inventory (Customer view)

| ID | Requirement | Priority |
|---|---|---|
| CAT-1 | Products grouped by category (Rice & Grains, Pulses, Oils & Ghee, Spices, Flour, Sugar & Jaggery, Snacks, Beverages, Dairy, Personal Care, Household, Pooja Items). | P0 |
| CAT-2 | Each product shows: image, name **in the user's chosen language**, pack size/unit (1 kg, 500 g, 1 L, 1 packet), price, and stock state. | P0 |
| CAT-3 | Stock state is one of: **In stock** / **Only N left** (when ≤ 5) / **Out of stock**. Out-of-stock items are visible but not addable. | P0 |
| CAT-4 | A product can have multiple **variants** (e.g. Sona Masoori rice: 1 kg / 5 kg / 25 kg bag) each with its own price, SKU and stock. | P0 |
| CAT-5 | Text search across product names in **all three languages** and common aliases (e.g. "atta", "gōdhi hiṭṭu", "ಗೋಧಿ ಹಿಟ್ಟು", "wheat flour" all find the same product). | P0 |
| CAT-6 | "Order again" — shows items from the customer's last 3 orders as one-tap add. | P1 |
| CAT-7 | Products marked `is_available = false` by the admin never appear, regardless of stock. | P0 |

### 5.3 ⭐ Voice ordering (the flagship feature)

| ID | Requirement | Priority |
|---|---|---|
| VOICE-1 | A large, always-reachable **mic button** on the customer home screen. One press starts listening; release or tap-again stops. | P0 |
| VOICE-2 | Accepts **Kannada, Hindi, English, and code-mixed speech** ("do kilo rice and ondu packet sugar") without the user having to pick a language first. | P0 |
| VOICE-3 | Live feedback while speaking: waveform + partial transcript on screen so the user knows it is hearing them. | P0 |
| VOICE-4 | The system parses the speech into **structured line items**: `{product, quantity, unit}`. Handles: <br>• numbers as words in all 3 languages (ಎರಡು / do / two)<br>• units (kg, kilo, ಕೆಜಿ, gram, litre, packet, ಪ್ಯಾಕೆಟ್, dozen, bottle)<br>• implicit quantity ("rice" → qty 1 of the default pack)<br>• multiple items in one sentence joined by "and / mattu / aur" | P0 |
| VOICE-5 | Each parsed item is matched to a real SKU. Matching uses product name + multilingual aliases + fuzzy/phonetic matching. | P0 |
| VOICE-6 | **The order is NEVER placed automatically from voice.** The parsed items are shown on a **confirmation screen** as editable cards with quantity steppers, and the user must tap "Place order". This is a hard rule. | P0 |
| VOICE-7 | Confidence handling: <br>• **High confidence** → item added, shown normally.<br>• **Ambiguous** (matched >1 product, e.g. "oil") → item shown with a chooser: "Which one? Sunflower / Groundnut / Coconut".<br>• **Not found** → shown in a "Couldn't find these" section with a search box and the original words the user said. | P0 |
| VOICE-8 | Out-of-stock voice items are flagged with a suggested in-stock alternative from the same category. | P1 |
| VOICE-9 | The confirmation screen reads the order back aloud (TTS) in the user's language, for customers who can't read. | P1 |
| VOICE-10 | If the mic permission is denied, the app explains why it needs it and offers manual ordering instead — it never dead-ends. | P0 |
| VOICE-11 | Voice works over 4G in under **5 seconds** from end-of-speech to confirmation screen for a 5-item order. | P0 |
| VOICE-12 | Every voice session is logged (audio ref, transcript, parsed JSON, what the user finally ordered) so accuracy can be measured and the alias dictionary improved. | P0 |

> **Design rule:** voice is an *input method*, not a separate mode. It fills the same cart as tapping. A user can start by voice and finish by tapping.

### 5.4 Cart, checkout & payment

| ID | Requirement | Priority |
|---|---|---|
| CART-1 | One persistent cart per customer, surviving app restarts and syncing across devices. | P0 |
| CART-2 | Stock is re-validated at checkout. If an item went out of stock, the user is told before payment, not after. | P0 |
| CART-3 | Order total = items subtotal + delivery fee − discount. Delivery fee is set by the admin, with a "free above ₹X" threshold. | P0 |
| CART-4 | Customer picks a saved address or adds a new one, and optionally a delivery time preference ("Now" / "This evening"). | P0 |
| CART-5 | **Payment choice: UPI (online) or Cash on Delivery.** | P0 |
| CART-6 | **UPI path:** the app shows the **shop owner's UPI QR code embedded in-app** with the exact amount and an order reference. On Android/iOS, also show **"Pay with GPay / PhonePe / Paytm" buttons** that open the UPI app with the amount pre-filled (UPI intent deep link) — so the customer on their phone doesn't have to scan their own screen. | P0 |
| CART-7 | After paying, the customer taps **"I have paid"** and enters/pastes the **UPI reference (UTR) number** — or uploads a screenshot. The order enters status `payment_pending_verification`. | P0 |
| CART-8 | The admin sees the pending payment, checks his own UPI app/bank SMS, and taps **Verify** or **Reject**. Verified → order moves to `confirmed`. Rejected → customer is notified and can retry or switch to COD. | P0 |
| CART-9 | **COD path:** order goes straight to `placed`. The amount to collect is shown to the delivery boy. | P0 |
| CART-10 | COD can be disabled by the admin above a configurable order value (e.g. no COD above ₹3,000). | P1 |
| CART-11 | The QR image and UPI ID are **configured by the admin in shop settings**, not hard-coded. | P0 |

> **Honest note carried into the TRD:** without a payment gateway, UPI confirmation is *manual*. This is intentional for v1 (zero fees, uses the shop's existing QR). Phase 2 swaps in Razorpay/Cashfree UPI for automatic reconciliation — the code must isolate this behind a payment-provider interface so the swap is a one-file change.

### 5.5 Order lifecycle

Canonical status flow:

```
PLACED ─┬─▶ PAYMENT_PENDING_VERIFICATION ──▶ CONFIRMED ──▶ PACKED ──▶ OUT_FOR_DELIVERY ──▶ DELIVERED
        │            │                                                                        │
        │            └──(rejected)──▶ PAYMENT_FAILED ──▶ (retry or COD)                       └──▶ COMPLETED (paid)
        └──(COD)──────────────────▶ CONFIRMED
Any state before OUT_FOR_DELIVERY ──▶ CANCELLED (by customer, or by admin with a reason)
OUT_FOR_DELIVERY ──▶ RETURNED (customer not available / refused)
```

| ID | Requirement | Priority |
|---|---|---|
| ORD-1 | Customer can cancel free of charge until the order is `PACKED`. After that, only the admin can cancel. | P0 |
| ORD-2 | Every status change is written to an immutable `order_status_events` table with actor + timestamp + note. | P0 |
| ORD-3 | Customer sees a live status timeline for the order. | P0 |
| ORD-4 | Push notification to the customer on every status change. | P0 |
| ORD-5 | Push + **in-app sound alert** to the admin on every new order. This must be impossible to miss. | P0 |
| ORD-6 | Admin can **edit an order before it is packed** (change quantity, remove an out-of-stock item) — the customer is notified and the total is recalculated. | P1 |

### 5.6 Admin — Inventory & catalogue management

| ID | Requirement | Priority |
|---|---|---|
| ADM-1 | Add / edit / delete products and variants: name (kn, hi, en), category, unit, pack size, purchase price, selling price, MRP, image, HSN (optional), low-stock threshold. | P0 |
| ADM-2 | **Add aliases** to a product ("what do customers call this?") — free text, any script. This directly feeds voice accuracy and is surfaced as a first-class action, not buried. | P0 |
| ADM-3 | Adjust stock: **Stock In** (with supplier, cost, batch, expiry), **Stock Out** (damage/expiry/self-use), and **Correction** (physical count). Every change is logged with a reason. | P0 |
| ADM-4 | **Low-stock dashboard**: everything at or below its threshold, sorted by how fast it sells. | P0 |
| ADM-5 | Bulk product import from CSV/Excel (for the initial ~300-item catalogue load). | P0 |
| ADM-6 | Barcode scan to look up / add stock for an existing product. | P2 |
| ADM-7 | Expiry alerts for perishables (items expiring within 15 days). | P1 |

### 5.7 Admin — Orders, delivery & customers

| ID | Requirement | Priority |
|---|---|---|
| ADM-8 | Live order board with tabs: **New** / **Preparing** / **Out for delivery** / **Completed** / **Cancelled**. | P0 |
| ADM-9 | Open an order → see items, customer, address, phone (one-tap call), payment method and status. | P0 |
| ADM-10 | **Assign a delivery boy** to one or more orders; reassign; unassign. | P0 |
| ADM-11 | Manage staff: add a delivery person by phone number, activate/deactivate. | P0 |
| ADM-12 | Customer list with order count, lifetime value, pending dues, and a "block" toggle. | P1 |
| ADM-13 | **Place an order on behalf of a customer** (for people who still phone the shop). Admin can also use voice for this. | P1 |
| ADM-14 | Shop settings: shop name, address, hours, open/closed toggle ("Shop closed — orders resume 7 AM"), delivery fee, free-delivery threshold, delivery radius, UPI ID + QR image upload. | P0 |

### 5.8 Admin — Invoices & reports

| ID | Requirement | Priority |
|---|---|---|
| INV-1 | On `DELIVERED`, an invoice is generated automatically: sequential number, shop header, customer, line items, quantities, rates, subtotal, delivery fee, total, payment method and status. | P0 |
| INV-2 | Invoice is a downloadable/shareable **PDF**, and can be sent to the customer over WhatsApp with one tap. | P0 |
| INV-3 | The customer can view and download all of their own invoices in the app. | P0 |
| INV-4 | GST fields (GSTIN, HSN, CGST/SGST split) are supported but **optional**, toggled in settings. | P1 |
| INV-5 | **Daily summary**: orders count, revenue, cash collected, UPI collected, top-selling items, items that went out of stock. | P0 |
| INV-6 | Date-range sales report, exportable as CSV. | P1 |
| INV-7 | Profit estimate per product using purchase price vs selling price. | P2 |

### 5.9 Delivery staff app

| ID | Requirement | Priority |
|---|---|---|
| DEL-1 | Home = a list of **only my assigned orders**, grouped Today / Earlier, sorted by assignment time. | P0 |
| DEL-2 | Order card shows: order #, customer name, address, distance, **AMOUNT TO COLLECT (or "PAID — collect nothing")** in large type. Payment status must be unmistakable. | P0 |
| DEL-3 | One-tap **Call customer** and one-tap **Navigate** (opens Google Maps with the address/pin). | P0 |
| DEL-4 | Buttons to move status forward: **Picked up** → **Delivered**. Cannot skip or go backwards. | P0 |
| DEL-5 | On **Delivered** for a COD order, he must confirm the cash amount collected. This creates a payment record. | P0 |
| DEL-6 | **Proof of delivery**: optional photo and/or customer signature. | P1 |
| DEL-7 | Mark **Not delivered** with a reason (not available / refused / wrong address) → order goes to `RETURNED` and the admin is alerted. | P0 |
| DEL-8 | **Offline-first**: status updates made without network are queued and synced automatically when the network returns. The app must never lose a "Delivered" tap. | P0 |
| DEL-9 | End-of-day summary: deliveries completed, total cash he is holding and must hand to the owner. | P0 |
| DEL-10 | Location is shared with the admin only while an order is `OUT_FOR_DELIVERY`, and never otherwise. | P1 |

### 5.10 Notifications

| Event | Customer | Delivery | Admin |
|---|:--:|:--:|:--:|
| New order placed | ✅ (confirmation) | — | ✅ **+ sound** |
| UPI payment submitted for verification | — | — | ✅ |
| Payment verified / rejected | ✅ | — | — |
| Order confirmed / packed | ✅ | — | — |
| Order assigned to me | — | ✅ | — |
| Out for delivery | ✅ | — | — |
| Delivered | ✅ (+ invoice) | — | ✅ |
| Order cancelled | ✅ | ✅ (if assigned) | ✅ |
| Stock below threshold | — | — | ✅ (daily digest) |

---

## 6. Content requirements

- The catalogue must ship with **~300 real products** with **Kannada, Hindi and English names** and at least 2 aliases each. This is a data task, not a code task, and it is on the critical path for voice quality. Budget real time for it.
- Product images: use consistent square photos on a plain background. Placeholder silhouettes per category are acceptable for launch.

---

## 7. Key product decisions & rationale

**7.1 Why voice must confirm before ordering.** A misheard "5 kg" instead of "500 g" costs the shop money and the customer trust. The confirmation screen is not a nicety; it is what makes voice ordering safe enough to ship.

**7.2 Why one app, not three.** Three apps means three Play Store listings, three release cycles, and a delivery boy who installs the wrong one. One app, role-based routing after login. Build the admin surface as its own navigator so it can be split out later if it ever needs to be.

**7.3 Why manual UPI verification in v1.** The shop already has a QR sticker on the counter. Adding a payment gateway means a merchant account, KYC, 1–2% fees and settlement delays. v1 uses the existing QR and asks the owner to do what he already does — glance at his phone. Isolate it behind a `PaymentProvider` interface so switching to Razorpay later touches one module.

**7.4 Why Kannada-first, not English-first.** The customers this app wins that Blinkit cannot are the ones who don't want to type English. Every screen must work if the user reads only Kannada.

---

## 8. Assumptions
- The shop has a single physical location and delivers within roughly 5 km.
- The owner has an Android phone with data and will keep the app open during shop hours.
- 1–3 delivery staff, not a fleet.
- Order volume ≤ ~100/day for the foreseeable future (this materially relaxes the scaling requirements).
- The owner's UPI QR is a static personal/merchant QR and he can read incoming-payment SMS/app alerts.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Voice accuracy is poor for Kannada grocery vocabulary | Flagship feature fails | Alias dictionary per product; log every session; confirmation screen absorbs errors; manual ordering always one tap away |
| Owner doesn't keep stock updated → phantom stock | Customer trust collapses | Stock auto-decrements on order; low-stock digest; "Out of stock" is a one-tap action from the order screen |
| Manual UPI verification is missed → customer waits | Bad first impression | Push + badge; auto-remind admin after 10 min; customer told upfront "usually verified within 15 minutes" |
| Delivery boy loses network at the doorstep | Lost delivery record | Offline queue (DEL-8) |
| Catalogue data entry never gets done | No launch | Treat as a Phase-0 deliverable with the CSV importer built first |

## 10. Open questions for the owner
1. Delivery fee and free-delivery threshold amounts?
2. Delivery radius in km?
3. Is a GSTIN required on invoices?
4. Shop hours, and should the app auto-close outside them?
5. Should customers be allowed to run a monthly *khata* (credit) balance? (Would be a v1.1 feature — significant.)
