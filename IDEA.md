### Project Concept: DineFlow AI

  DineFlow AI is an automated, WhatsApp-native conversational AI ordering and table reservation platform integrated
  with a real-time host and receptionist management dashboard for hospitality businesses.
  ──────
  ### The Problem Addressed

  Restaurants currently handle customer interactions across fragmented tools—phone calls, manual reservation books,
  third-party delivery services, and physical walk-ins. This creates operational bottlenecks, double-booking risks,
  long customer wait times, and disconnected customer data. Furthermore, existing online ordering systems often force
  customers through rigid, multi-step web forms or app downloads.
  ──────
  ### The Core Philosophy

  "One Unified Engine, Multiple Customer Entry Points"

  DineFlow AI allows customers to interact with a restaurant directly through WhatsApp using natural language, while
  providing a single consolidated backend engine for all customer entry paths:

  1. Table Reservations: Pre-booking tables for specified party sizes and dates.
  2. Dine-In Ordering: Instant ordering from the table without waiting for staff.
  3. Takeaway Orders: Pre-ordering meals for scheduled pickup.
  4. Delivery & Menu Browsing: Exploring menus, checking item availability, and placing orders.

  Because all paths share the same underlying menu catalog, cart logic, and inventory validation, the restaurant
  maintains a single source of truth across all channels.
  ──────
  ### Key Capabilities

  #### 1. WhatsApp Conversational AI Agent

  • Driven by Google Gemini Natural Language Processing (NLU) to interpret customer intents in freeform text.
  • Understands requests such as booking a table for a specific party size or querying menu options.
  • Applies strict validation rules for operational hours (11:00 AM – 11:00 PM), maximum party sizes (1–20 guests),
  and real-time menu item stock availability.
  • Utilizes a state machine to safely guide conversations from welcome messages to confirmed bookings and orders.

  #### 2. Real-Time Host & Receptionist Dashboard

  • Built using React and WebSockets for instantaneous, two-way updates between the host desk and customer messages.
  • Displays an interactive visual floor plan with live table statuses (Available, Reserved, Occupied).
  • Features a smart walk-in recommendation algorithm that instantly identifies optimal table assignments based on
  guest count.
  • Provides live operational metrics, including occupancy rates, seat-to-guest ratios, and waitlist counts.

  #### 3. Enterprise Infrastructure

  • Built with NestJS, PostgreSQL, Redis, and BullMQ for reliable, asynchronous message queueing.
  • Protects against duplicate requests via database-backed message idempotency and HMAC signature validation on
  incoming webhooks.
  • Implements robust exception filtering and graceful degradation when external services experience high load.
  ──────
  ### Summary

  DineFlow AI bridges the gap between modern messaging channels and restaurant operations. It turns WhatsApp into an
  automated digital receptionist and ordering clerk, while delivering a sleek, real-time command center for floor
  managers and staff.
