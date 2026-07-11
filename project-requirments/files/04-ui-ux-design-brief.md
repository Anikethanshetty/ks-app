# UI/UX Design Brief
## Krishnappa Shetty and Son's — Home Delivery App

**Version:** 1.0

---

## 1. The design thesis

This app is not a quick-commerce app. Blinkit and Zepto sell *speed*, and their design language — countdown timers, urgency, a wall of discount badges — is built for that. This shop sells something else: **it is the shop you have bought rice from for twenty years, and it knows your name.**

So the design borrows from the shop itself, not from the app store. A kirana counter is: **enamel and brass, printed paper labels, jute sacks with the grain visible, a weighing scale, a ledger with ruled columns.** It is orderly, tactile, and unhurried. It is also, importantly, *legible from a distance* — the price boards in a provision store are written large because customers are reading them across a counter, sometimes without their glasses.

**Design direction: "The counter."** Deep enamel-green surfaces, a brass accent that appears only where the shop touches you (price, total, the mic), and typography sized as if it were a hand-lettered price card. Generous, plain, calm, and readable by a 55-year-old in bright Mysuru daylight.

**The one aesthetic risk:** the customer home screen is not a product grid. It is a **speaking screen** — a single large brass-ringed microphone occupying the visual centre, with the catalogue tucked below the fold. We are betting the shop's differentiator on voice, so the design bets on it too. If the mic is a small icon in the corner, nobody will ever use it, the flagship feature dies, and the app becomes a worse Blinkit.

---

## 2. Design tokens

### 2.1 Colour

Named for the shop's own world. These are the only colours in the app.

| Token | Hex | Use |
|---|---|---|
| `enamel` | `#0F3A32` | Primary surface for headers, the mic stage, admin chrome. A deep enamel green — the colour of an old shop signboard. |
| `enamel-deep` | `#082621` | Pressed states, shadows on `enamel`, the delivery app's payment banner. |
| `brass` | `#C8912F` | **The accent, used sparingly.** The mic ring, prices, totals, the primary CTA. If it's brass, it's about money or it's about the voice. Nothing else. |
| `brass-tint` | `#F3E4C4` | Brass at 15% — selected chips, the "voice order" badge. |
| `paper` | `#FBFAF6` | App background. A warm near-white, like a fresh bill book. (Warm, but explicitly *not* the cream-and-terracotta look — the pairing here is green/brass, not clay.) |
| `ruled` | `#E3E2DA` | Hairlines, dividers, card borders. Named for ledger rules. |
| `ink` | `#1B1D1A` | Primary text. |
| `ink-soft` | `#6A6E67` | Secondary text, captions, "heard as…" lines. |
| `fresh` | `#2E7D4F` | In stock, delivered, verified. Positive only. |
| `chilli` | `#C0392B` | Out of stock, cancel, reject, destructive only. |
| `turmeric` | `#E0A93B` | Warnings, "pending verification", low stock. |

Dark mode: **not in v1.** (The owner and the delivery boy both use the app outdoors in sun. Optimise for that, not for a dark aesthetic.)

### 2.2 Typography

| Role | Family | Why |
|---|---|---|
| Display / headings | **Anek** (`Anek Kannada`, `Anek Devanagari`, `Anek Latin`) — Semibold 600 | One superfamily by Ek Type that covers all three scripts with **matching x-heights, weights and metrics**. A Kannada heading and an English heading will look like the same design, not like two apps stitched together. This is the single most important type decision in the project. |
| Body / UI | **Anek**, Regular 400 / Medium 500 | Same family, keeps the tri-script UI coherent. |
| Numerals: prices, totals, stock, invoices | **IBM Plex Mono**, Medium — tabular figures | Money should line up in columns like a ledger. In the invoice and the admin reports, digits align. This is also a legibility win: `₹1,062` never reads as `₹1062` by accident. |

**Type scale** (sp, and these are deliberately larger than a typical app):

| Token | Size / line | Use |
|---|---|---|
| `display` | 34 / 40 | The mic prompt, order total on the success screen |
| `h1` | 26 / 32 | Screen titles |
| `h2` | 21 / 28 | Section headers, product names on detail |
| `body-lg` | 18 / 26 | **Default body.** Yes, 18. Not 14. |
| `body` | 16 / 24 | Secondary text |
| `caption` | 14 / 20 | Metadata only. Never for anything a customer must act on. |
| `price` | 20 / 24 Plex Mono | Product prices |
| `price-lg` | 30 / 34 Plex Mono | Cart total, amount to collect |

Must survive OS font scaling to 130% without clipping. Test it.

### 2.3 Space, shape, elevation

- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Screen gutter: **20**.
- Corner radius: `card 14` · `button 12` · `chip 999` · `sheet 24 (top only)`.
- Elevation: **almost none.** One soft shadow token (`0 2 8 rgba(15,58,50,0.08)`) for cards and sheets. This is a flat, printed-paper world, not a floating-material one.
- Minimum tap target: **48 × 48 dp**, and **56 dp** for anything in the delivery app (he is wearing a helmet and standing on a road).

---

## 3. The signature element: the mic

The customer home screen's hero is a **brass-ringed microphone stage** on an `enamel` panel.

```
╔══════════════════════════════════════════╗
║  enamel panel                            ║
║                                          ║
║   Krishnappa Shetty and Son's            ║   Anek 600, paper on enamel
║   ● Open · delivers in about an hour     ║   14sp, fresh dot
║                                          ║
║              ⌢⌢⌢⌢⌢                       ║
║          ╭───────────────╮               ║
║          │               │               ║   96dp circle, paper fill,
║          │      🎤       │               ║   3dp brass ring
║          │               │               ║   idle: slow breathing scale
║          ╰───────────────╯               ║   1.0 → 1.03, 2.4s ease-in-out
║              ⌣⌣⌣⌣⌣                       ║
║                                          ║
║      ಆರ್ಡರ್ ಹೇಳಿ                          ║   display, paper
║      "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ, ಒಂದು ಲೀಟರ್ ಎಣ್ಣೆ"    ║   body, ink-soft on enamel @70%
║                                          ║   ↑ a rotating real example
╚══════════════════════════════════════════╝
   ─── paper background from here down ───
   Order again   [Rice 1kg +] [Oil 1L +] [Sugar +]
   Categories    ▢ ▢ ▢ ▢ ▢ ▢
```

**States**
| State | Treatment |
|---|---|
| Idle | Brass ring, slow breathe. The example sentence rotates every 4 s through the three languages. |
| Pressed / listening | Ring thickens to 5 dp, an amplitude-reactive brass waveform ring pulses around it in real time, and the partial transcript types itself under the mic in `h2`. |
| Processing | Ring becomes a brass arc rotating once per second. Copy: "Understanding your order…" |
| Permission denied | Mic goes `ink-soft`, and a plain-language card explains why the mic is needed with a manual-order escape hatch. Never a dead end. |

**Motion:** 200 ms `ease-out` for everything except the mic breathe. The waveform is the only continuous animation in the app. Respect `prefers-reduced-motion`: the breathe stops, the waveform becomes a static level bar.

---

## 4. Component specifications

### 4.1 Product card (customer)
```
┌──────────────────────────────────────────┐  card, paper, 1px ruled border, r14
│ ┌────────┐  ಸೋನಾ ಮಸೂರಿ ಅಕ್ಕಿ              │  h2 / ink — name in active language
│ │        │  Sona Masoori Rice            │  caption / ink-soft — always show
│ │  img   │  1 kg                         │      English underneath in kn/hi mode
│ │  72dp  │                               │      (people read the pack in English)
│ └────────┘  ₹62      ● In stock          │  price / brass   ·  caption / fresh
│                              [  ADD  ]   │  brass button, 48dp, r12
└──────────────────────────────────────────┘
```
- Once in the cart, `[ADD]` becomes a `[− 2 +]` stepper in brass. Same footprint, no layout shift.
- **Out of stock:** the card drops to 55% opacity, the stock line reads `Out of stock` in `chilli`, and the button is replaced by a disabled ghost. The card is still *readable* — the customer needs to know the shop normally has it.
- **Low stock:** `Only 3 left` in `turmeric`. Truthful, not fake urgency. Never a countdown timer.

### 4.2 Voice confirmation card (C03) — the most important component in the app
```
┌─────────────────────────────────────────────┐
│ Sona Masoori Rice · 1 kg              ₹124  │  h2 / price(brass)
│ ┌─────────────────────────────────────────┐ │
│ │ 🎙 heard "eradu kg akki"                │ │  brass-tint pill, caption/ink-soft
│ └─────────────────────────────────────────┘ │  ← THIS is the trust device.
│                        [ − 2 + ]        ✕   │     Show the user their own words
└─────────────────────────────────────────────┘     next to what we understood.
```
The `heard "…"` pill is non-negotiable. It is what lets a customer trust a voice order at a glance — she can see that "eradu" became 2, and correct it in one tap if it didn't.

Three sections, in this order, with these headers:
- **`✓ Found`** (`fresh`) — editable cards as above
- **`? Which one did you mean?`** (`turmeric`) — the spoken words as a heading, radio options below
- **`✗ Not found`** (`chilli`) — spoken words + `[Search]` `[Remove]`

### 4.3 Amount-to-collect banner (delivery app) — the second most important
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  COLLECT ₹266  ·  CASH                  ┃   enamel-deep bg, brass text,
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   price-lg (30sp Plex Mono)

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  PAID ONLINE  ·  COLLECT NOTHING        ┃   fresh bg, paper text,
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   same size
```
The two states must be **impossible to confuse at a glance, in sunlight, on a bike**. Different background colour, different word, same enormous type. Money mistakes here cost the owner real cash.

### 4.4 UPI payment screen (C09)
The QR is the hero: **240 dp square, `paper` card, brass hairline border**, the amount printed *directly beneath it* in `price-lg`. Under that, the UPI ID in Plex Mono with a copy button. Then the app buttons (GPay/PhonePe/Paytm — only if installed). Then the UTR field.

Do not use a payment-gateway aesthetic here. This is the shop's own QR sticker, reproduced faithfully, framed as if it were sitting on the counter.

### 4.5 Order status timeline
Vertical rail in `ruled`, with a filled `fresh` dot for completed steps, a pulsing `brass` dot for the current step, and a hollow `ruled` dot for the future. Each row: status name (`body-lg`) + time (`caption`, Plex Mono). No delivery-tracking map for the customer in v1 — a status timeline that is *honest* beats a map that lies.

### 4.6 Buttons
| Variant | Look |
|---|---|
| Primary | `brass` fill, `enamel-deep` label, 52 dp tall, r12 |
| Secondary | `paper` fill, 1.5 dp `enamel` border, `enamel` label |
| Destructive | `chilli` text on `paper`, `chilli` border |
| Ghost | `ink-soft` text only |
Full-width primary CTAs, always docked to the bottom on cart/checkout/confirmation, above a `ruled` divider on a `paper` bar.

---

## 5. Navigation

**Customer** — bottom tabs (4): `Home (mic)` · `Shop` · `Cart (badge)` · `Orders`
**Delivery** — bottom tabs (2): `Deliveries` · `Today` — that's it. Anything more is clutter he doesn't need.
**Admin** — bottom tabs (4): `Orders (live badge)` · `Inventory` · `Reports` · `Settings`

Icons are line-weight 2 dp, `ink-soft` inactive / `enamel` active with a small brass underline. Labels always visible (icon-only tabs fail for older users).

---

## 6. Localisation rules

1. **Every string in `locales/{kn,hi,en}.json`.** A hardcoded English string is a bug.
2. **Kannada and Hindi need ~20–30% more horizontal space than English.** Never fix a button width to fit English. Test every screen in Kannada *first*, English last.
3. Product names show the **active-language name as the heading and the English name as the subhead**, always. People search in Kannada but recognise brands in English.
4. Numbers, prices and quantities always use **Western Arabic digits** (`2 kg`, not `೨ ಕೆ.ಜಿ.`). This is what shop price boards actually use and it prevents an entire class of confusion.
5. The language switcher lives in the profile screen *and* is reachable from the very first screen. People hand their phone to a family member.

---

## 7. Required states for every screen

No screen ships without all five:

| State | Rule |
|---|---|
| **Loading** | Skeletons matching the real layout. Never a bare spinner on a full screen. |
| **Empty** | An illustration, one plain sentence saying what this screen will show, and **one action**. An empty screen is an invitation, not a dead end. |
| **Error** | What went wrong, in the shop's voice, and what to do next. "Couldn't reach the shop. [Try again]" — never "Error 500", never an apology, never vague. |
| **Offline** | A persistent `turmeric` strip: "No internet — showing saved data." Delivery app additionally shows "⏳ 2 updates will sync". |
| **Success** | Confirm in the same words as the action. The button said "Place order", so the toast says "Order placed". |

---

## 8. Voice and tone of copy

- **Plain, warm, second person, sentence case.** The shop talking to a neighbour, not a brand talking to a user.
- Use active verbs that name the outcome: **Place order** (not Submit), **I have paid** (not Confirm payment), **Collected ₹266 in cash** (not Mark complete).
- No exclamation marks. No "Oops!". No "Awesome!". No emoji in system copy (emoji are fine as functional icons: 🎤 📞 🧭).
- Never blame the customer. Not "Invalid input" but "That doesn't look like a 12-digit reference number."
- Kannada copy must be written by a **native speaker**, not machine-translated. Machine-translated Kannada is instantly recognisable and it will cost the app exactly the customers it was built for. Budget for this.

---

## 9. Accessibility floor
- Contrast ≥ 4.5:1 for all text (`brass` on `enamel` = 5.9:1 ✓; `brass` on `paper` = 3.1:1 ✗ → **brass text on paper is only permitted at ≥ 20 sp / semibold**, which is why prices are large).
- Every icon button has an `accessibilityLabel` in the active language.
- Voice ordering is an accessibility feature in itself — treat it as such and never gate it behind a paywall, a tutorial, or a settings toggle.
- Support OS font scaling to 130%.
- Colour is never the only signal: out-of-stock says "Out of stock", it isn't merely grey.

---

## 10. What we are deliberately not doing
- ❌ No countdown timers, no "3 people are viewing this", no fake scarcity.
- ❌ No carousel of banner ads on the home screen.
- ❌ No dark mode in v1.
- ❌ No onboarding carousel. The app must be self-evident.
- ❌ No live map for the customer (v1.1, and only if customers ask for it).
- ❌ No gradient buttons, no glassmorphism, no floating pill nav. This is a shop, not a fintech landing page.
