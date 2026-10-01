# NagarDrishti AI: Feature Matrix

Comprehensive summary of implemented features across the NagarDrishti AI platform.

---

## 1. Citizen Portal Capabilities

| Module | Implemented Features | Description |
|--------|----------------------|-------------|
| **Authentication** | Supabase Auth Integration | Email and password authentication with persistent JWT session, automatic token refresh, and guest tracker mode. |
| **Civic Reporting** | Guided Multi-Step Wizard | Step-by-step reporting workflow with photo preview, AI analysis review, location tagging, and final confirmation. |
| **AI Vision Analysis** | Multimodal Problem Classification | Detects potholes, garbage, streetlights, and drains with confidence score and observable visual evidence. |
| **Visual Severity** | Deterministic Severity Rating | Rules-based severity engine evaluating indicators into LOW, MEDIUM, HIGH, and CRITICAL tiers. |
| **Department Routing** | Automated Suggestion | Maps problem type to municipal department (Roads, Sanitation, Electrical) with citizen override capability. |
| **Geolocation** | Interactive Map & GPS | One-tap browser GPS acquisition or manual pin placement on Leaflet / OpenStreetMap. |
| **My Reports** | Personal Tracking Center | List and detail view of all citizen-filed complaints with status badges, timestamps, and filter tabs. |
| **Notifications** | Civic Event Notification Hub | In-app notification center alerting citizens when authority assigns, progresses, or resolves their complaint. |
| **Resolution Verification** | Citizen Confirmation | Side-by-side inspection of original report vs. authority resolution photo; one-click confirmation lock. |
| **Complaint Reopen** | Quality Safeguard | Ability to reopen an unsatisfactory resolution before confirmation with a mandatory reason logged to the audit trail. |
| **Status Requests** | Official Inquiries | Citizens can submit formal status-update inquiries on stalled reports, visible in authority queue. |
| **Civic Discovery** | Nearby Issues Map | Privacy-safe map view displaying nearby reported civic problems with blurred coordinates to prevent duplicate submissions. |
| **Public Status Tracker** | PII-Safe Anonymous Tracking | Anyone with a report ID (e.g., `NGD-2026-00238`) can track lifecycle progress without revealing citizen identity or private contact info. |
| **Share Status** | Social & Web Share | One-click copy link and Web Share API integration for sharing report status with neighbors and community groups. |
| **Accessibility & i18n** | Multi-Language Support | Full UI localization support across 12 Indian languages including Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, and Punjabi. |

---

## 2. Authority Command Center Capabilities (Separate Portal)

| Module | Implemented Features | Description |
|--------|----------------------|-------------|
| **Command Dashboard** | Real-Time Civic KPI Cards | High-level metrics: total complaints, pending triage, in-progress tasks, resolved count, and critical alerts. |
| **GIS Intelligence** | Heatmap & Corridor Clusters | Visual density heatmap of open complaints and automated spatial clustering of issue hotspots. |
| **Triage & Priority** | Algorithmic Priority Queue | Priority scoring combining AI-assessed visual severity, civic category weight, and SLA aging time. |
| **Aging Indicators** | SLA Overdue Warning | Visual timers showing complaint age and highlighting reports approaching SLA breach. |
| **Assignment Workflow** | Officer & Department Dispatch | Assignment of complaints to specific municipal field officers and divisions with status transition logging. |
| **Internal Notes** | Officer Collaboration | Private authority-only operational notes and progress remarks (redacted from public citizen summaries). |
| **Status Transitions** | Structured Lifecycle Management | Full state machine: `REPORTED` ➔ `ASSIGNED` ➔ `IN_PROGRESS` ➔ `RESOLVED` / `REOPENED`. |
| **Resolution Proof** | Photo Evidence Upload | Mandatory photographic proof upload and technician notes before marking an issue resolved. |
| **Escalation & Auditing** | Complete Audit Trail | Detailed chronological history of status changes, actor roles, timestamps, and citizen reopen reasons. |
| **Governance Analytics** | Charts & Breakdowns | Department workload distribution, problem category pie charts, resolution rate metrics, and hotspot trends. |
| **Data Export** | CSV / Excel Data Export | One-click export of filtered complaint records and audit history for municipal governance reporting. |
| **Demo Safeguards** | Non-Destructive Reset | `POST /api/dashboard/reset-demo` resets demo records to pristine state without altering real citizen submissions. |
