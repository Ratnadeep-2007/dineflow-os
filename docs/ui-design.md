# UI Design Specification
## WhatsApp AI Ordering & Reservation System

Applies the Red / White / Black theme from `design.md` to the two real surfaces in this product: the **WhatsApp conversational interface** (customer-facing, mostly Meta-controlled chrome) and the **Receptionist Dashboard** (admin-facing, full custom UI).

---

## 1. Two Different Design Problems

These are not the same design problem and shouldn't be treated as one:

| | WhatsApp Interface | Receptionist Dashboard |
|---|---|---|
| Chrome control | None — Meta controls the container UI (message bubbles, buttons, fonts) | Full control |
| Where brand shows up | Message copy tone, button labels, any images/media sent, business profile photo | Every pixel |
| Design constraint | List/button messages have Meta-imposed limits (character counts, max button count) | Standard web app constraints |
| Primary goal | Fast, low-friction, unambiguous choices | Fast scanning + confident quick actions under time pressure (a receptionist is often mid-conversation with a walk-in while doing this) |

Applying a heavy red/black visual system to the WhatsApp side is mostly pointless — you don't control bubble color or font. What you *do* control there is covered in Section 2.

---

## 2. WhatsApp Interface

### 2.1 What You Actually Control

- **Business Profile:** photo/logo (this is the one place brand color can show — use the red/black logomark here), business description, category
- **Message copy tone:** short, warm, professional — matches the "premium, not fast-food-loud" positioning from `design.md`
- **Interactive message structure:** button labels, list titles — Meta enforces character limits (button text ≤ 20 chars, list item title ≤ 24 chars), so copy must be tight
- **Emoji use as a lightweight visual signal**, since you can't set colors: 🍽️ 🛍️ 🛵 📖 for the four entry options is doing the job a colored icon would do in a native app

### 2.2 Copy Standards (Tone = brand, since color mostly isn't available here)

| Don't | Do | Why |
|---|---|---|
| "OMG yes! Let's get you fed! 🎉🎉🎉" | "Great — let's get your table sorted." | Matches "professional," avoids reading like a discount-QSR bot |
| "ERROR: Invalid input" | "I didn't quite catch that — could you tell me the party size as a number, like '4'?" | Never expose raw system errors to the customer; always recoverable, never a dead end |
| Long paragraph explaining the whole flow upfront | One question at a time | WhatsApp is a conversation, not a form — front-loading kills completion rate |

### 2.3 Message Flow Reference (from architecture doc, Section 5 state machine)

```
[State 0] Welcome
  "Hello! Welcome to [Restaurant Name]. How can we help you today?"
  🍽️ Dine In   🛍️ Take Away   🛵 Delivery   📖 Browse Menu

[State 1] Dine In sub-choice
  "Would you like to reserve a table for later, or order now at your table?"
  Reserve a Table   Order Now

[State 2] Booking metadata (one question per message)
  "How many guests?" → numeric quick-reply buttons (1-2-3-4-5+)
  "What date and time?" → date/time picker or structured text prompt
  "Thanks — we're checking availability. You'll hear back shortly."

[State 3] Queue wait
  No further message until receptionist acts — do not leave the customer
  wondering; if queue wait exceeds a threshold (e.g. 5 min), send a
  proactive holding message: "Still confirming your table — thanks for
  your patience!"

[State 4] Confirmed
  "🎉 Table [X] is confirmed for [time]. Want to pre-order food to save time?"
  Yes, pre-order   No, thanks
```

**Design requirement not in v1 wireframes:** State 3 needs an explicit timeout/holding-message rule. Leaving a customer with zero feedback for an unbounded queue wait is a real drop-off risk — this is a UX requirement, not just a backend nice-to-have.

### 2.4 Error & Edge States (missing from v1, required for "reliable")

| Situation | Message Pattern |
|---|---|
| AI couldn't parse the input | Ask a narrower, closed-ended question instead of repeating the same open prompt |
| Requested table/time unavailable | Offer 2-3 concrete alternatives, never just "not available" |
| Menu item requested is out of stock | State it plainly and suggest the closest available alternative |
| Session resumed after 24h+ gap | First message must be a pre-approved template (see `architecture.md` Section 6) — cannot pick up mid-conversation with free text |

---

## 3. Receptionist Dashboard

This is where the red/white/black system from `design.md` actually applies in full.

### 3.1 Layout (refined from v1 wireframe)

```
+-----------------------------------------------------------------------------------------+
| [Logo]   Floor Map | Reservations Queue | Walk-ins        🔔3   [Receptionist Name ▾]   |
+-----------------------------------------------------------------------------------------+
| FILTERS                          |  DETAIL PANEL (selected item)                        |
| [Search name/phone___]           |  Ratnadeep · +91 98765 43210                         |
| Status: (•All) ( )Pending        |  Source: WhatsApp · Pending 3 min                    |
|         ( )Active                |  Requested: Tonight, 8:00 PM · 4 guests              |
|                                   |                                                       |
| QUEUE (pending sorted first)     |  TABLE ASSIGNMENT                                    |
| ┌───────────────────────────┐    |  [ Table 4 (suggested) ▾ ]  Capacity 4 · Main Floor  |
| │🔴 Ratnadeep · 4 guests     │    |                                                       |
| │  Tonight 8:00 PM · WhatsApp│    |  [ Confirm Booking ]   [ Edit Details ]              |
| │  ⏱ Pending 3 min           │    |  [ Cancel Reservation ]                              |
| └───────────────────────────┘    |                                                       |
| ┌───────────────────────────┐    |                                                       |
| │⚫ Rahul K. · 2 guests      │    |                                                       |
| │  Tonight 8:30 PM · Walk-in │    |                                                       |
| └───────────────────────────┘    |                                                       |
+-----------------------------------------------------------------------------------------+
```

### 3.2 Applying the Palette

| Element | Treatment |
|---|---|
| Header bar | White background, black logo/nav text, red accent underline on active tab |
| New WhatsApp booking indicator | Red dot/badge with count (`🔔3`) — the one place pure alert-red is expected and correct |
| Queue card — WhatsApp source | Small red icon marker (distinguishes from walk-in) |
| Queue card — Walk-in source | Black/grey icon marker, no red — reserve red for "needs attention / time-sensitive" signaling, not just as decoration |
| Elapsed queue timer | Text turns from Muted Grey → Amber → Error Crimson as wait time crosses thresholds (e.g. >5min amber, >10min crimson) — this is functional color, not brand red |
| Primary buttons (Confirm Booking) | Solid `#D62828`, white text |
| Destructive action (Cancel Reservation) | Outlined in Error Crimson `#B00020`, not brand red — visually distinct from "Confirm" so a rushed receptionist doesn't misclick between "confirm" and "cancel" during a busy service |
| Floor map — Occupied | Red fill (as in v1 spec) |
| Floor map — Reserved | Amber/Yellow fill |
| Floor map — Available | Forest Green fill |

**Correction from v1:** the original floor map spec used "Red = Occupied" as a status color, which is fine, but it's a different red usage than the brand's primary action red. Both should visually read as related-but-distinct — occupied-table-red can be a duller, more muted red (`#B33A3A`) versus brand-action red (`#D62828`) so a receptionist scanning fast doesn't misread a status indicator as a clickable button.

### 3.3 Component Hierarchy (from v1, unchanged structurally)

```
DashboardApp/
├── Header/
│   ├── Navigation (Floor Map, Queue Manager, Walk-ins)
│   └── SystemAlerts (real-time visual + optional sound ping)
├── QueueManager/
│   ├── FilterBar
│   ├── QueueList
│   │   └── QueueCard (source icon, elapsed timer w/ color escalation, status badge)
│   └── DetailPanel (table selector, actions)
├── FloorMap/
│   ├── FloorZoneGrid
│   └── TableCard
└── WalkInModal/
    └── WalkInForm
```

### 3.4 Accessibility & Operational Requirements

- Elapsed-timer color escalation (Section 3.2) must **never rely on color alone** — pair with the literal minute count as text, since a receptionist glancing quickly (or with color vision deficiency) needs the number, not just the hue
- All primary actions (Confirm, Cancel, Edit) need keyboard shortcuts — a busy front desk shouldn't require precise mouse clicks under time pressure
- WebSocket disconnect state (see `architecture.md` Section 7) needs a visible banner in this UI — "Reconnecting... showing last known state" — silent staleness is worse than an obvious warning

---

## 4. What's Deliberately Out of Scope for This Doc

- Customer-facing web ordering UI (Browse Menu on WhatsApp routes into structured list messages, not a web view, per current architecture) — if a future version adds a web/PWA ordering surface, that needs its own UI spec
- Kitchen display — explicitly a non-goal per PRD Section 1.3
