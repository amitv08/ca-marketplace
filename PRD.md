1.1 Product overview
A two‑sided web marketplace where clients can create service requests for CAs/CA firms, track status, collaborate, pay, and leave reviews.
​
1.2 Core actors
Client
CA (or CA firm – currently mostly modeled as “provider”)
Platform admin (basic or future)

1.3 Key flows (MVP)
Client registers, logs in, views dashboard.
Client creates service requests and sees them by status (Pending, In Progress, Completed, Cancelled).
CA progresses requests and marks them completed.
Client pays for completed services (payment flow partially implied, check implementation).
Client leaves a single review per completed request; existing review is displayed instead of “Leave Review.”
​
1.4 Current implemented highlights (from the doc)
Client dashboard with status filters and notification text fixes.
​Request cancellation rules and clearer error messages.
completedAt timestamp and data validation script to fix inconsistent statuses.
​Review creation page and route; check‑once review logic per request.
​E2E test plan and bash script for client flows.
​
1.5 Obvious missing / future areas (high level)
Full CA/CA‑firm side flows (dashboards, team members, assignment).
Admin tools (verification, disputes, fee configuration).
Robust payment & escrow abstraction.
Rich search/filtering (service type, CA attributes, etc.).
System‑level security, RBAC hardening, analytics.