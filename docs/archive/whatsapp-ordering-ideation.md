# WhatsApp AI Ordering System — Final Ideation

## Core Principle

**One ordering engine. Multiple entry points.** The customer's path (dine-in, takeaway, delivery, or just browsing) should never fork into separate menu/cart/checkout systems. It only changes *how* an order starts — not how it's processed.

---

## Entry Flow

```
                     WhatsApp
                        │
                        ▼
              Choose Experience

 ┌──────────┬───────────┬────────────┬─────────────┐
 │ Dine In  │ Take Away │  Delivery  │ Browse Menu │
 └──────────┴───────────┴────────────┴─────────────┘
      │           │            │             │
      ▼           ▼            ▼             ▼
  Reserve?       Menu      Address      (undecided —
  or Order                    │          commits later)
  Now?                        ▼
      │              Delivery Provider
      │              (Restaurant / Swiggy / Zomato)
      │                       │
      └───────────┬───────────┘
                   ▼
          Unified Menu Engine
                   │
           AI Recommendations
                   │
                 Cart
                   │
              Checkout
                   │
        Loyalty + CRM Update
```

---

## Path Details

### 1. Dine In

Don't force a reservation immediately — some customers are already seated.

```
Dine In
  │
  ├─ Reserve a Table (WhatsApp Request)
  │     → Party size → Date → Time → Sent to Pending Queue
  │     → Receptionist assigns table & confirms (OR Receptionist registers direct walk-in)
  │     → WhatsApp Confirmation → Pre-order? (yes/no)
  │
  └─ Order Now (Already Seated)
        → Table number (manual entry OR QR auto-detect)
        → Menu → Order → Kitchen
```

**Walk-In & Edit Support:** The receptionist can bypass the WhatsApp queue and book/assign tables directly from the admin interface for guests standing in-person. The receptionist can edit any booking detail (party size, name, contact, reservation time, or assigned table) from the queue at any time. When a WhatsApp-linked booking is modified, the system automatically triggers a WhatsApp update notification to sync details back to the customer.

**WhatsApp vs. Dashboard Interface Roles:**
*   **WhatsApp (Customer View):**
    *   *Inputs:* Interactive buttons / text prompts to choose order path, input Name, Party Size, Date, and Time.
    *   *AI Conversations:* Natural language search, combo suggestions, persistent session diet filters (e.g. vegetarian), items selection.
    *   *Real-time Push Alerts:* Automated notifications when booking enters queue, gets confirmed/assigned, gets edited/modified by receptionist, or has cart checkout/payment ready.
*   **Admin Dashboard (Receptionist View):**
    *   *Real-time Booking Queue:* Real-time listing of WhatsApp requests with queue duration and status toggles. Direct buttons to Assign Table, Edit Details, Confirm, or Cancel.
    *   *Walk-In Booking:* A simple input form to directly register in-person walk-ins and assign them tables.
    *   *Floor Status Map:* Visual layout tracking Available (Green), Reserved (Yellow), and Occupied (Red) tables.

**Open decision:** pick ONE canonical way to identify the table — manual entry or QR auto-detect — not both. Running both invites mismatches (wrong manual entry, or a QR code pointing at a stale/moved table ID). Whichever you pick becomes the single source of truth for `table_id`.

### 2. Take Away

No reservation, no delivery — kept deliberately simple.

```
Menu → AI Recommendations → Cart → Pickup Time → Payment → Ready Notification
```

### 3. Delivery

Provider is selected **before** the menu loads, because pricing, availability, and offers differ per provider.

```
Delivery Address → Check Serviceability → Delivery Options
  (Restaurant Direct / Swiggy / Zomato)
  → Load Correct Menu → Order → Payment → Tracking
```

**Operational risk to plan for:** if the restaurant's own menu (item, price, 86'd item) changes, does it sync to Swiggy/Zomato automatically, or does someone update three panels by hand? This is the real bottleneck, not the WhatsApp flow itself. Worth deciding early whether you're building/using a menu-sync layer or accepting manual triple-entry.

### 4. Browse Menu (new addition)

For customers who don't yet know how they want to order. They explore first, commit later.

**Backend implication:** `orderType` can't always be known upfront. You need either:
- `orderType: "BROWSING"` as a valid state that later transitions to `DINE_IN` / `TAKEAWAY` / `DELIVERY`, or
- a `null` orderType until commit.

This needs to be in the schema from day one — retrofitting it after the cart/checkout logic assumes a fixed order type is more painful than designing for it up front.

---

## Shared Ordering Engine

Every path funnels into the same sequence:

```
Menu → Category → Items → Variants → Add-ons → Cart → Review → Confirm
```

Do not build three separate ordering systems. One engine, parameterized by entry context.

---

## AI Layer (runs during ordering, any path)

Natural language queries against the live menu, not a static FAQ:

- *"Something spicy under ₹500"* → AI filters current menu by tag + price
- *"Recommend something for four people"* → AI builds a combo/bundle
- *"I'm vegetarian"* → AI applies a persistent dietary filter for the session

---

## Backend Order Object (illustrative)

```json
{
  "orderType": "DELIVERY",
  "provider": "SWIGGY",
  "restaurantId": "123"
}
```

```json
{
  "orderType": "DINE_IN",
  "table": "12"
}
```

```json
{
  "orderType": "TAKEAWAY"
}
```

```json
{
  "orderType": "BROWSING"
}
```

The ordering engine should be indifferent to how the order started — it only cares about the final `orderType` and its payload once committed.

---

## Open Questions Before Build

1. **Table ID source of truth** — manual entry vs QR, pick one.
2. **Browsing → commit transition** — define the state machine for when a browsing session converts into an actual order type.
3. **Menu sync across providers** — automated sync vs manual multi-panel updates for Swiggy/Zomato/direct.
4. **Session persistence** — how long does a WhatsApp session/cart stay alive before it's considered abandoned?
5. **Payment timing** — is payment required to confirm a reservation pre-order, or only at fulfillment?
