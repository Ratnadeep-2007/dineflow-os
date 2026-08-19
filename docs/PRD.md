# Product Requirements Document
## WhatsApp AI Ordering System

**Status:** Draft v1
**Author:** Ratnadeep
**Date:** August 2026

---

## 1. Overview

A WhatsApp-native ordering system for restaurants that supports dine-in, takeaway, and delivery through a single unified ordering engine. The system uses conversational AI to help customers find menu items, build orders, and get recommendations, regardless of which entry path they choose.

### 1.1 Problem Statement

Restaurants currently manage ordering across fragmented channels — in-person, phone, Swiggy, Zomato, and sometimes a separate own-website or app — each with different menus, different order tracking, and no unified customer data. Customers face friction being forced into a rigid flow (e.g., reservation-first) when their actual need is simpler (e.g., "I'm already seated, let me just order").

### 1.2 Goal

Build a single WhatsApp-based ordering flow that:
- Adapts to what the customer actually wants instead of forcing a fixed sequence
- Shares one ordering engine (menu, cart, checkout) across all order types
- Uses AI to reduce menu-browsing friction (natural language search, filtering, recommendations)
- Feeds a unified CRM/loyalty system regardless of entry path

### 1.3 Non-Goals (v1)

- Building a native mobile app (WhatsApp is the only channel for v1)
- Building an in-house delivery fleet/logistics system (Swiggy/Zomato integration only)
- Multi-restaurant marketplace — v1 is single-restaurant / single-brand scoped
- Kitchen display system (KDS) — order goes to kitchen via existing tooling, not built here

---

## 2. Users

| User | Need |
|---|---|
| Walk-in / seated diner | Order quickly without going through reservation flow |
| Customer planning a visit | Reserve a table, optionally pre-order food |
| Takeaway customer | Order ahead, pick up at a set time |
| Delivery customer | Get accurate pricing/availability for their chosen provider |
| Undecided browser | Explore the menu before committing to an order type |
| Restaurant staff | Receive orders in one place regardless of channel |

---

## 3. Core Principle

**One ordering engine. Multiple entry points.**

The customer's entry path (dine-in, takeaway, delivery, browse) determines *how an order starts* — not how it's processed. Menu browsing, cart, and checkout logic must be shared, not duplicated per path. This is a hard architectural constraint, not a preference: building three parallel ordering systems creates a permanent maintenance burden (three menus to update, three carts to test, three checkout bugs to fix).

---

## 4. Functional Requirements

### 4.1 Entry Flow

The customer is presented with four choices on first contact:

1. Dine In
2. Take Away
3. Delivery
4. Browse Menu

**Requirement:** All four paths must converge into the same downstream Menu → Cart → Checkout engine (see Section 4.6).

### 4.2 Dine In

- Must NOT force reservation as the only option.
- Sub-choice: **Reserve a Table** or **Order Now**.

**Reserve a Table (Queue-Based Approval, Walk-In & Editing Support):**
- **Step 1 (WhatsApp Request):** Customer selects "Reserve a Table" and inputs: Party size → Date → Time.
- **Step 2 (Admin Queue):** The request enters a "Pending Reservations Queue" in the receptionist's admin panel.
- **Step 3 (Receptionist Assignment & Edit):** The receptionist reviews the queue, assigns an available table, and clicks "Confirm". The receptionist can edit any booking detail (party size, name, contact, reservation time, or assigned table) from the queue at any time.
- **Step 4 (Walk-In Support):** The receptionist can manually create reservations directly on the panel for walk-in / in-person customers (who didn't book through WhatsApp), with full access to edit their reservation details.
- **Step 5 (Confirmation & Pre-order Option):** For WhatsApp requests, once confirmed, the system sends a notification to the customer with their assigned table details and asks if they want to pre-order food (yes/no). If they select yes, they route into the shared Menu flow with `orderType: DINE_IN`, `mode: PRE_ORDER`.
- **Step 6 (Customer Notifications for Edits):** If the receptionist edits or updates details for any WhatsApp-linked reservation (e.g., changing the time or table due to restaurant constraints), the system automatically triggers a WhatsApp update notification to the customer detailing the changed parameters.

**Order Now:**
- For customers already seated
- Table identification: **must use a single canonical method** — either manual table number entry or QR-code auto-detection. Both cannot coexist as parallel paths (creates mismatch risk between a manually entered wrong number and a stale QR-linked table ID). **Decision required before build.**
- Routes directly into shared Menu flow

### 4.3 Take Away

- No reservation step, no delivery step
- Flow: Menu → AI Recommendations → Cart → Pickup Time selection → Payment → Ready Notification

### 4.4 Delivery

- Delivery provider must be selected **before** menu is loaded, since price, availability, and offers vary by provider
- Flow: Delivery Address → Serviceability Check → Provider Selection (Restaurant Direct / Swiggy / Zomato) → Load Provider-Specific Menu → shared Order flow → Payment → Tracking
- **Dependency:** Menu content must be synced across all providers. Requirement: either build an automated sync layer, or explicitly accept and document manual multi-panel menu updates as a v1 limitation.

### 4.5 Browse Menu

- Customer can explore the menu without committing to an order type upfront
- System must support an order session in an uncommitted state
- Order type is resolved only at the point the customer proceeds to checkout (system prompts: "How would you like to receive this order?")

### 4.6 Shared Ordering Engine

All paths converge here:

```
Menu → Category → Items → Variants → Add-ons → Cart → Review → Confirm
```

This must be implemented as a single reusable engine parameterized by `orderType` and its associated context (table, provider, pickup time), not duplicated per path.

### 4.7 AI Layer

Runs during any ordering session, independent of entry path.

| Capability | Example |
|---|---|
| Natural language menu search | "Something spicy under ₹500" → filtered results |
| Combo building | "Recommend something for four people" → AI-built bundle |
| Dietary filtering | "I'm vegetarian" → persistent session filter applied to all subsequent views |

**Requirement:** AI recommendations must only surface items that are currently available (in stock, not 86'd) and priced according to the active provider context.

---

## 5. Data Model (Illustrative)

Order object varies by type but shares a common shape:

```json
{ "orderType": "DELIVERY", "provider": "SWIGGY", "restaurantId": "123" }
```
```json
{ "orderType": "DINE_IN", "table": "12" }
```
```json
{ "orderType": "TAKEAWAY" }
```
```json
{ "orderType": "BROWSING" }
```

**Requirement:** The ordering engine must be indifferent to `orderType` at the menu/cart level — it only needs the final resolved type and its payload at checkout time.

---

## 6. Success Metrics

To be defined with the business, but candidates:

- % of sessions that complete an order vs abandon (per entry path)
- Time from session start to order confirmation
- % of orders using AI recommendation/filter features
- Repeat order rate (loyalty/CRM tie-in)

*(Note: no baseline data exists yet for any of these — they need to be tracked from v1 launch, not assumed.)*

---

## 7. Open Questions / Decisions Required Before Build

1. **Table ID source of truth** — manual entry vs QR code, must pick one.
2. **Browsing → commit state machine** — exact transition logic and where `orderType` gets locked in.
3. **Menu sync strategy across delivery providers** — automated vs manual, and who owns keeping them in sync.
4. **Session expiry** — how long does an inactive WhatsApp cart/session persist before being considered abandoned?
5. **Payment timing** — is payment required to confirm a dine-in pre-order reservation, or only collected at fulfillment (table/pickup/delivery)?
6. **WhatsApp Business API provider** — which BSP (e.g., Meta Cloud API direct, Twilio, Gupshup) will host this, and what are that provider's session-window/messaging-cost constraints for AI-driven back-and-forth?

---

## 8. Risks

| Risk | Impact | Notes |
|---|---|---|
| Menu desync across providers | Wrong price/availability shown to customer | Highest operational risk in the doc — needs an owner and a process, not just a system |
| WhatsApp session window limits | AI conversation may get cut off or require template messages | Needs verification against WhatsApp Business API session-window rules (24-hour customer-initiated window) before assuming free-form AI chat works indefinitely |
| Table ID conflicts | Order routed to wrong table | Resolved by picking one canonical ID method (see Open Question 1) |
| AI recommending unavailable items | Customer frustration, order errors | AI layer must query live inventory, not a cached/stale menu snapshot |
