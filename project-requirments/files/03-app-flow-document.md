# App Flow Document
## Krishnappa Shetty and Son's — Home Delivery App

**Version:** 1.0
Every screen, every transition, every edge case. If a path isn't here, it doesn't exist in v1.

---

## 0. Screen inventory

| # | Screen | Role | Route |
|---|---|---|---|
| S00 | Splash / language picker | all | `/` |
| S01 | Phone login | all | `/(auth)/login` |
| S02 | OTP entry | all | `/(auth)/otp` |
| S03 | Onboarding (name + address) | customer | `/(auth)/onboarding` |
| C01 | Customer home (**mic button**) | customer | `/(customer)/` |
| C02 | Voice listening overlay | customer | modal |
| C03 | ⭐ Voice confirmation | customer | `/(customer)/voice-confirm` |
| C04 | Category listing | customer | `/(customer)/category/[id]` |
| C05 | Product detail | customer | `/(customer)/product/[id]` |
| C06 | Search | customer | `/(customer)/search` |
| C07 | Cart | customer | `/(customer)/cart` |
| C08 | Checkout (address · slot · payment) | customer | `/(customer)/checkout` |
| C09 | UPI payment (QR + apps) | customer | `/(customer)/payment/[orderId]` |
| C10 | Order placed / success | customer | `/(customer)/orders/[id]?new=1` |
| C11 | My orders | customer | `/(customer)/orders` |
| C12 | Order detail + status timeline | customer | `/(customer)/orders/[id]` |
| C13 | Invoices | customer | `/(customer)/invoices` |
| C14 | Profile & addresses | customer | `/(customer)/profile` |
| D01 | My deliveries | delivery | `/(delivery)/` |
| D02 | Delivery detail | delivery | `/(delivery)/order/[id]` |
| D03 | Collect payment | delivery | modal on D02 |
| D04 | End-of-day summary | delivery | `/(delivery)/summary` |
| A01 | Order board (live) | admin | `/(admin)/orders` |
| A02 | Order detail (admin) | admin | `/(admin)/orders/[id]` |
| A03 | Assign delivery | admin | sheet on A02 |
| A04 | Pending UPI payments | admin | `/(admin)/payments/pending` |
| A05 | Inventory list | admin | `/(admin)/inventory` |
| A06 | Product add/edit (incl. aliases) | admin | `/(admin)/inventory/product/[id]` |
| A07 | Stock adjust | admin | sheet on A05/A06 |
| A08 | CSV import | admin | `/(admin)/inventory/import` |
| A09 | Voice quality / add aliases | admin | `/(admin)/voice-quality` |
| A10 | Customers | admin | `/(admin)/customers` |
| A11 | Staff | admin | `/(admin)/staff` |
| A12 | Reports & daily summary | admin | `/(admin)/reports` |
| A13 | Invoice view/share | admin | `/(admin)/invoices/[id]` |
| A14 | Shop settings (**UPI QR upload**) | admin | `/(admin)/settings` |

---

## 1. First launch & authentication

```
APP OPEN
  │
  ├─ has session? ──yes──▶ read profiles.role
  │                          ├─ customer ──▶ C01
  │                          ├─ delivery ──▶ D01
  │                          └─ admin    ──▶ A01
  │
  └─ no session
        ▼
      S00 Language picker  [ ಕನ್ನಡ ] [ हिन्दी ] [ English ]
        │  (saved to device + later to profile)
        ▼
      S01 Enter mobile number  +91 ▢▢▢▢▢▢▢▢▢▢   → [Send OTP]
        │   ├─ invalid number → inline error, stay
        │   └─ rate limited (>5/hr) → "Too many attempts. Try after an hour."
        ▼
      S02 OTP (6 digits, auto-read on Android)
        │   ├─ wrong OTP → error, 3 attempts, then resend cooldown 30 s
        │   ├─ expired → "Code expired. Resend."
        │   └─ correct
        ▼
      Does a profile exist?
        ├─ yes → route by role
        └─ no  → S03 Onboarding
                   Name → Delivery address (house/flat, street, area,
                   landmark, PIN, "Use my current location" pin)
                   → [Start shopping] → C01
```

**Edge cases**
- A number promoted to `delivery` or `admin` by the owner skips S03 and lands on D01 / A01.
- If the address is outside the delivery radius: allow signup, but at checkout show "We don't deliver to this area yet" with the shop's phone number.

---

## 2. ⭐ Voice ordering flow (the primary path)

```
C01 CUSTOMER HOME
  ┌────────────────────────────────────────┐
  │  Krishnappa Shetty and Son's           │
  │  Open · Delivers in ~60 min            │
  │                                        │
  │        ╭──────────────────╮            │
  │        │       🎤          │  ← hold or tap
  │        │   ಆರ್ಡರ್ ಹೇಳಿ     │
  │        ╰──────────────────╯            │
  │   "Say: two kg rice and one litre oil" │
  │                                        │
  │  Order again  ▸  [Rice 1kg] [Oil 1L]   │
  │  Categories   ▸  ▢ ▢ ▢ ▢               │
  └────────────────────────────────────────┘
        │ tap mic
        ▼
  MIC PERMISSION?
    ├─ denied first time → explain: "To order by voice, the app needs the
    │   microphone. Your voice is sent only to the shop's system to understand
    │   your order." → [Allow] / [Order by tapping instead → C04]
    └─ denied permanently → deep-link to OS settings + offer manual path
        ▼
  C02 LISTENING OVERLAY
      ● live waveform
      ● partial transcript appears as they speak
      ● [ Stop ] button, and auto-stop after 2 s of silence (max 30 s)
      ● [ Cancel ] returns to C01, discards audio
        │ user stops
        ▼
  PROCESSING (≤5 s target)
      Skeleton of the confirmation screen + "Understanding your order…"
        ├─ network error → "Couldn't reach the shop. [Try again] [Order by tapping]"
        │                   (the recorded audio is kept, so Retry doesn't re-record)
        ├─ STT returned empty → "I didn't catch that. [Try again]"
        └─ success
        ▼
  C03 ⭐ VOICE CONFIRMATION  — nothing is ordered yet
  ┌────────────────────────────────────────────────────┐
  │  You said: "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಮತ್ತು ಒಂದು ಲೀಟರ್ ಎಣ್ಣೆ"     │
  │  🔊 (tap to hear the order read back)              │
  │                                                    │
  │  ✓ FOUND                                           │
  │  ┌──────────────────────────────────────────┐      │
  │  │ Sona Masoori Rice · 1 kg   ₹62           │      │
  │  │ heard "eradu kg akki"      [− 2 +]  ✕    │      │
  │  ├──────────────────────────────────────────┤      │
  │  │ Sunflower Oil · 1 L        ₹142          │      │
  │  │ heard "ondu litre enne"    [− 1 +]  ✕    │      │
  │  └──────────────────────────────────────────┘      │
  │                                                    │
  │  ? WHICH ONE DID YOU MEAN?                         │
  │  ┌──────────────────────────────────────────┐      │
  │  │ You said "dal" (1)                       │      │
  │  │ ( ) Toor Dal 1kg  ( ) Moong Dal 1kg      │      │
  │  │ ( ) Urad Dal 1kg  ( ) Chana Dal 1kg      │      │
  │  └──────────────────────────────────────────┘      │
  │                                                    │
  │  ✗ NOT FOUND                                       │
  │  ┌──────────────────────────────────────────┐      │
  │  │ "Maggi noodles"        [Search] [Remove] │      │
  │  └──────────────────────────────────────────┘      │
  │                                                    │
  │  ⚠ Out of stock: Ghee 500ml                        │
  │     Try instead → Ghee 1 L  [Add]                  │
  │                                                    │
  │  Subtotal ₹266                                     │
  │  [ 🎤 Say more ]         [ Place order → ]         │
  └────────────────────────────────────────────────────┘
```

**Rules on C03**
- **"Place order" is the only way forward.** No auto-submit, ever.
- **"Say more"** re-opens the mic and *appends* to the existing list (does not replace it).
- Quantity steppers, remove (✕), and ambiguity choosers all edit the list in place.
- If *everything* was unmatched → show an empathetic empty state: "I couldn't find any of those items. [Try again] [Browse instead]" and link the transcript into `voice_sessions` so the admin sees it in A09.
- Tapping [Place order] merges these items into the normal cart and jumps straight to **C08 Checkout** (not the cart screen — one step less).

---

## 3. Manual ordering flow

```
C01 HOME
  ├─ tap Category ─▶ C04 CATEGORY LISTING
  │                    grid/list of products, each with
  │                    [image] name (in chosen language) · pack · ₹price
  │                    [ADD] or [− n +] if already in cart
  │                    Out-of-stock cards greyed, ADD replaced by "Notify me" (P2)
  │                    → tap card ─▶ C05 PRODUCT DETAIL
  │                                  image, description, variants (1kg/5kg/25kg),
  │                                  stock line, [Add to cart]
  ├─ tap Search ────▶ C06 SEARCH
  │                    types in any script; results match kn/hi/en names + aliases
  │                    empty result → "We don't have that. Tell the shop →" (P2)
  └─ tap "Order again" chip ─▶ adds that item straight to the cart
        │
        ▼
      C07 CART
        line items · [− n +] · remove (swipe or ✕)
        subtotal · delivery fee · total
        [Add more items]              [Checkout →]
        ├─ empty cart → illustration + [Browse] + [🎤 Order by voice]
        └─ an item went out of stock while in the cart →
             banner "Rice 5kg is no longer available" + auto-flag the row,
             Checkout blocked until it is removed
```

---

## 4. Checkout & payment

```
C08 CHECKOUT
  1. Delivery address
       [saved addresses radio] + [+ Add new address]
       → outside radius → block with shop phone number
  2. Delivery time
       ( ) As soon as possible   ( ) This evening (5–8 PM)
       → shop is CLOSED → banner "Shop is closed. Orders will be delivered
         from 7 AM tomorrow." (ordering still allowed unless admin disabled it)
  3. Payment method
       ( ) Pay online with UPI   ( ) Cash on delivery
       → COD hidden if total > cod_limit → "Orders above ₹3,000 must be paid online."
  4. Bill summary  (items · delivery fee · total)
  5. [ Place order ]
        │
        ├─ server: place_order()  ──┐
        │                           ├─ OUT_OF_STOCK error → return to cart with
        │                           │   the offending row highlighted. Nothing charged.
        │                           └─ success
        │
        ├── COD ────▶ order = CONFIRMED ──▶ C10 SUCCESS
        │
        └── UPI ────▶ order = PAYMENT_PENDING_VERIFICATION ──▶ C09
                        ▼
        C09 UPI PAYMENT — order #KSS-1042 · ₹266
        ┌────────────────────────────────────────┐
        │  Pay ₹266 to Krishnappa Shetty & Son's │
        │                                        │
        │    ┌──────────────────┐                │
        │    │   [ QR CODE ]    │  ← shop's own  │
        │    │   (from admin    │     QR, from   │
        │    │    settings)     │     settings   │
        │    └──────────────────┘                │
        │    UPI ID: krishnappa@okaxis           │
        │                                        │
        │  Or pay from this phone:               │
        │  [ GPay ]  [ PhonePe ]  [ Paytm ]      │
        │            (only installed apps shown) │
        │                                        │
        │  After paying:                         │
        │  UTR / Reference no.  ▢▢▢▢▢▢▢▢▢▢▢▢     │
        │  [ Upload screenshot (optional) ]      │
        │  [ I have paid ]                       │
        │                                        │
        │  [ Pay cash instead ]  → switches to COD│
        └────────────────────────────────────────┘
                ▼ [I have paid]
        "Payment sent for checking. The shop usually confirms
         within 15 minutes." ──▶ C10 SUCCESS (status: awaiting confirmation)
```

**Edge cases**
- User closes the app on C09 → the order sits in `payment_pending_verification`; C11 shows it with a **[Complete payment]** button that returns to C09.
- Payment rejected by admin → push: "We couldn't find your payment. [Try again] or [Pay cash on delivery]."
- Auto-cancel unpaid UPI orders after 60 minutes (`pg_cron`), restoring stock. The customer is warned of this on C09.

---

## 5. Order tracking (customer)

```
C12 ORDER DETAIL
  Order #KSS-1042 · placed 4:12 PM
  ┌── status timeline (live, via Realtime) ──┐
  │ ● Placed              4:12 PM            │
  │ ● Payment confirmed   4:19 PM            │
  │ ● Packed              4:31 PM            │
  │ ◐ Out for delivery    4:48 PM            │
  │   Ravi is on the way · [Call Ravi]       │
  │ ○ Delivered                              │
  └──────────────────────────────────────────┘
  items · bill · address · payment method
  [Cancel order]   ← visible only until PACKED
  [Download invoice]  ← appears on DELIVERED
  [Reorder]           ← appears on DELIVERED
```

---

## 6. Admin flow

```
A01 ORDER BOARD  (live; new orders arrive with a sound)
  Tabs:  NEW (3) · PREPARING (2) · OUT (1) · DONE · CANCELLED
  Card: #KSS-1042 · Lakshmi · ₹266 · UPI ✅verified / ⏳to verify / COD
        4 items · 4:12 PM · "🎤 voice order" badge
        [Open]
        │
        ▼
A02 ORDER DETAIL
  customer (name, phone → [Call]) · address (→ [Map])
  items (with a per-row [Out of stock] action → removes item, recalcs, notifies)
  payment: COD ₹266  |  UPI — UTR 4512… [screenshot] [Verify ✓] [Reject ✕]
  actions: [Confirm] → [Packed] → [Assign delivery ▸ A03] → (auto: Out for delivery)
           [Cancel order] (requires a reason)
        │
        ▼
A03 ASSIGN DELIVERY (bottom sheet)
  Ravi   · 2 active   [Assign]
  Suresh · 0 active   [Assign]
  → on assign: push to that delivery boy, order → OUT_FOR_DELIVERY when he
    taps "Picked up"

A04 PENDING PAYMENTS
  A queue of UPI submissions, oldest first, each with amount + UTR + screenshot
  and [Verify] / [Reject]. Badge count in the tab bar. Reminder push at 10 min.

A05 INVENTORY
  Tabs: ALL · LOW STOCK (7) · OUT OF STOCK (2) · EXPIRING SOON
  Row: name · pack · ₹price · stock  [Adjust stock ▸ A07]  [Edit ▸ A06]
  [+ Add product]   [Import CSV ▸ A08]

A06 PRODUCT EDIT
  names (kn / hi / en) · category · variants (pack, SKU, MRP, cost, price, stock,
  low-stock threshold) · image · availability toggle
  ⭐ ALIASES — "What do customers call this?"
     chips: [ಅಕ್ಕಿ] [akki] [rice] [chawal] [चावल]  [+ Add]
     ↑ this is what makes voice work; the screen tells the owner so

A07 STOCK ADJUST (sheet)
  ( ) Stock in   → qty, cost/unit, supplier, batch, expiry
  ( ) Stock out  → qty, reason (damaged / expired / shop use)
  ( ) Correction → counted qty, note
  Every adjustment writes an inventory_movement.

A09 VOICE QUALITY
  "Words customers said that we couldn't match" (last 30 days)
  "maggi" ×4   → [Search product] → [Add as alias to …]
  "sabbu"  ×2   → [Add as alias to: Soap Bar]
  ↑ one tap improves voice accuracy permanently

A12 REPORTS
  TODAY: orders 14 · revenue ₹6,240 · cash ₹2,100 · UPI ₹4,140
  Top items · Out-of-stock events · [Date range] [Export CSV]

A14 SETTINGS
  Shop name, address, hours, [Shop is OPEN/CLOSED toggle]
  Delivery fee ₹__ · Free above ₹__ · Radius __ km · COD limit ₹__
  ⭐ PAYMENT: UPI ID ▢▢▢  |  [Upload QR image]  → preview of exactly what the
     customer sees on C09
  Invoice: GST on/off, GSTIN, invoice prefix
```

---

## 7. Delivery flow

```
D01 MY DELIVERIES
  ┌────────────────────────────────────────┐
  │ TODAY                                  │
  │ ┌────────────────────────────────────┐ │
  │ │ #KSS-1042 · Lakshmi                │ │
  │ │ 3rd Cross, Kuvempunagar             │ │
  │ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓      │ │
  │ │ ┃ COLLECT ₹266  (CASH)      ┃      │ │  ← unmissable
  │ │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛      │ │
  │ │ [📞 Call]  [🧭 Navigate]  [Open]    │ │
  │ └────────────────────────────────────┘ │
  │ ┌────────────────────────────────────┐ │
  │ │ #KSS-1043 · Rajesh                 │ │
  │ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓      │ │
  │ │ ┃ PAID ONLINE · COLLECT ₹0  ┃      │ │
  │ │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛      │ │
  │ └────────────────────────────────────┘ │
  └────────────────────────────────────────┘
        │ Open
        ▼
D02 DELIVERY DETAIL
   items checklist (tap to tick while loading the bag)
   [ Picked up ]  ──▶ order = OUT_FOR_DELIVERY, customer notified
        ▼
   [ Delivered ]  ──▶ COD?  ──yes──▶ D03 COLLECT PAYMENT
                       │              amount due ₹266
                       │              [ ✓ Collected ₹266 in cash ]
                       │              [ Collected a different amount → ₹__ + note ]
                       │              (optional photo / signature)
                       └──no───▶ mark delivered directly
        ▼
   order = DELIVERED · invoice generated · customer notified
   
   [ Could not deliver ] → reason (not available / refused / wrong address)
        → order = RETURNED, admin alerted, stock restored on admin confirmation

OFFLINE: any of these taps with no network → queued, row shows "⏳ will sync",
         drains automatically on reconnect. Never lost, never duplicated.

D04 END OF DAY
   Delivered 8 · Returned 1
   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
   ┃ CASH IN HAND: ₹1,840        ┃   ← hand this to the owner
   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
   Owner marks it received in A12 → the delivery boy's balance resets to ₹0.
```

---

## 8. Global error & empty states

| Situation | Behaviour |
|---|---|
| No internet | Full-width banner: "No internet. Showing your last saved data." Customer can browse the cached catalogue but not check out. |
| Server unreachable | "Can't reach the shop right now. Call us on 0821-XXXXXXX." |
| Shop closed | Home banner: "Shop is closed. We open at 7 AM." Ordering allowed (delivered next morning) unless the admin disabled ordering. |
| Session expired | Silent refresh; if that fails → S01 with "Please log in again." |
| Empty cart | Illustration + [Browse categories] + [🎤 Order by voice] |
| No orders yet | "No orders yet. Your first order is one sentence away." + mic button |
| Voice found nothing | "I couldn't find those items." + transcript shown + [Try again] [Browse] |
| Delivery boy has no assignments | "No deliveries assigned yet. You'll get a notification." |
| Admin has no orders today | "No orders yet today." + [Place an order for a customer] |
