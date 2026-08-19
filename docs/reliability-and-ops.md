# Reliability & Operations Specification
## WhatsApp AI Ordering & Reservation System

**Status:** New. Covers what "reliable" and "suitable for current market" concretely require beyond the architecture doc's failure-mode table (`architecture.md` Section 7).

---

## 1. What "Reliable" Actually Means Here

For a restaurant floor system, reliability isn't uptime percentage in the abstract — it's specific to the failure modes that cost the business money or embarrass staff in front of a customer:

- A table gets double-booked
- A customer pays and the kitchen never sees the order
- A receptionist can't see the queue during dinner rush because the dashboard silently stopped updating
- A WhatsApp message goes out with wrong information after an edit

Each of these maps to a specific design decision already made in `architecture.md` — this doc makes the operational side of those decisions explicit.

---

## 2. Market Context (India Restaurant Tech, as of early 2026)

A few grounding points, stated plainly with confidence levels:

- **WhatsApp is the dominant consumer messaging channel in India** — this part is well-established and not in question.
- **Swiggy and Zomato dominate delivery-order volume** for restaurants that use them — this system's "Delivery" path is realistically a routing/aggregation layer on top of those platforms for most restaurants, not a replacement for them. I haven't verified current market share numbers for this response; if that matters for a pitch/investor context, that's worth a dedicated search rather than assuming stale figures.
- **WhatsApp Business API costs are usage-based** (conversation-based pricing from Meta, layered with your BSP's markup if using Twilio/Gupshup rather than direct Cloud API) — this is a real, recurring operating cost that scales with order volume, not a one-time build cost. This should be modeled into the business's unit economics before committing to a BSP, since the architecture doc leaves this choice open.

**What I won't do:** assert specific current pricing figures or market share percentages from memory in a fast-moving space like this — those change and I'd rather flag that a fresh check is needed than hand you a number that's wrong.

---

## 3. Uptime & Recovery Targets (Draft — Needs Business Sign-off)

No SLA currently exists in any of the docs. Proposed starting targets, meant to be adjusted with the business owner, not treated as final:

| Component | Target | Rationale |
|---|---|---|
| WhatsApp inbound → response | < 5s for structured (button) flows, < 15s for AI-parsed free text | Beyond this, customers assume the bot is broken and abandon |
| Dashboard real-time queue update | < 2s from webhook received to dashboard display | Receptionist needs near-real-time visibility during service |
| Database write availability | 99.9% (allows ~8.7h downtime/year) | Reasonable for single-restaurant v1; tighten only if multi-location |
| Recovery Time Objective (RTO) | < 15 min for full write-path outage | How long the business can tolerate "can't take new orders/bookings" before real revenue impact |
| Recovery Point Objective (RPO) | < 5 min of data loss in worst case | Determines backup frequency (Section 4) |

---

## 4. Backup & Disaster Recovery

Not addressed in v1 architecture at all. Minimum viable plan:

- **PostgreSQL:** automated daily full backup + continuous WAL archiving (point-in-time recovery), retained minimum 30 days
- **Redis:** treat as ephemeral/rebuildable — session state and idempotency keys can tolerate loss (worst case: a brief window of duplicate-processing risk right after a Redis restart, mitigated by the DB-level `WEBHOOK_EVENTS` unique constraint as a second line of defense, not just Redis)
- **Restore drill:** actually test a restore from backup at least once before launch, and periodically after — an untested backup is not a backup, it's a hope
- **Multi-AZ or regional failover** — not required for v1 single-restaurant scale, but the DB provider choice (managed Postgres like RDS/Cloud SQL/Supabase vs self-hosted) should keep this upgrade path open rather than requiring a re-architecture later

---

## 5. Load & Scale Considerations

Realistic load for a single restaurant, stated honestly — this is not a high-traffic system by web standards:

- Peak concurrent WhatsApp conversations: likely dozens, not thousands, for a single restaurant during dinner rush
- Peak dashboard concurrent users: single digits (front-desk staff count)
- **The bottleneck is more likely to be the Gemini API rate limits or Meta's messaging rate limits than your own infrastructure** at this scale — worth checking Meta's messaging-tier rate limits (these scale with your WhatsApp Business "quality rating" and phone number tier) against realistic order volume, rather than assuming the AI/messaging providers can absorb unlimited burst traffic

**If this becomes multi-restaurant/multi-location (beyond current PRD non-goals):** the architecture would need a `restaurant_id` scoping review across every table and every query — worth flagging now even though it's explicitly out of scope, so the schema isn't accidentally built in a way that makes that migration painful later.

---

## 6. Monitoring & Alerting (Operational View)

Complements `architecture.md` Section 8 (observability) with the operational "who does what when it fires" layer:

| Alert | Trigger | Response |
|---|---|---|
| Webhook processing failure rate spike | >5% of webhooks failing in a 5-min window | On-call checks Meta status page + own server logs — could be Meta-side or app-side |
| Outbound notification queue backing up | Queue depth exceeds threshold for >2 min | Check Meta API status; customers may not be getting confirmations |
| AI validator rejection rate spike | Rejection rate crosses baseline threshold | Could indicate prompt drift, menu data issue, or abuse attempt (see `security.md` Section 6) |
| Dashboard WebSocket disconnect rate | Unusual disconnect frequency | Could indicate infra issue affecting live restaurant operations in real time — highest urgency, staff are actively relying on this during service |
| Database replica lag | Replica falls significantly behind primary | Dashboard may show stale queue data — needs prompt fix, not just a log entry |

**Practical note for a small team:** you don't need enterprise-grade tooling (Datadog/PagerDuty) at v1 — a simple alerting setup (e.g., logs → threshold alerts → Slack/WhatsApp message to the dev on-call) is enough, as long as *someone* is actually reachable when it fires. The tooling matters less than having a real person accountable.

---

## 7. Launch Readiness Checklist (Cross-Referenced)

Before going live with a real restaurant, minimum bar:

- [ ] Webhook signature verification implemented and tested (`security.md` §3.3)
- [ ] Idempotency guard tested with a simulated duplicate webhook (`architecture.md` §4)
- [ ] AI validator tested against deliberately malformed/adversarial input (`security.md` §6)
- [ ] WhatsApp message templates submitted and approved by Meta with buffer time for review (`architecture.md` §6)
- [ ] Backup restore drill completed at least once (Section 4)
- [ ] RBAC roles configured, no shared logins (`security.md` §3.1)
- [ ] Payment gateway chosen and tokenization-based flow confirmed (no raw card data touches your servers) (`security.md` §5)
- [ ] Incident response contacts named for the four scenarios in `security.md` §8
- [ ] Realistic load test against Meta's actual rate limits for your business tier (Section 5)
- [ ] DPDP-aligned data deletion process documented, even if manual at this scale (`security.md` §4)

This list should grow as the system does — it's a starting bar, not a complete one.
