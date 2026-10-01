# NagarDrishti AI — Authority Portal Features

This document provides a comprehensive operational reference for all capabilities implemented in the NagarDrishti AI Authority Portal.

---

### 1. Command Center
- **Executive Metrics Ribbon**: Real-time KPI counters tracking Total Intake, In Progress, Resolved, Citizen Reopened cases, and Pending Citizen Inquiries.
- **Civic Lifecycle Pipeline Ribbon**: Visual step indicator mapping the 6-stage lifecycle (Citizen Report → Vision AI → Authority Triage → Assignment → Resolution → Citizen Verification).
- **Time Horizon Filter**: Multi-horizon switcher (Last 24 Hours, 7 Days, 30 Days, All Time) dynamically recalculating intake rates and volume velocity.
- **Search & Quick Triage**: Real-time freeform search filtering by Report ID, locality name, keyword, or problem description.

---

### 2. GIS Intelligence
- **Multi-Mode Visualization**:
  - **Markers Mode**: Individual geo-located pins with severity color-coding (Critical: Rose, High: Amber, Medium: Sky, Low: Slate).
  - **Clusters Mode**: Grouped density bubbles for high-incident wards with zoom-to-expand.
  - **Heatmap Mode**: Dynamic density heat raster highlighting high-intensity civic defect zones.
- **Intelligence Overlays**: Filter map views by *All Incidents*, *Top Priority*, *Civic Hotspots*, and *High-Risk Corridors*.
- **India-Wide Geographic Coverage**: Bhopal (`[23.2599, 77.4126]`) configured as default operational center; dynamic coordinate bounding handles complaints from any Indian municipality.
- **Interactive Pin Selection**: Selecting any map marker instantly opens the corresponding complaint in the Complaint Drawer without page reload.
- **GPS Verification Tool**: Crosshair coordinate indicator for live map clicks and device geolocation verification.

---

### 3. Priority Intelligence
- **Deterministic Multi-Factor Scoring**:
  - Ranks urgent cases on a 0–100 scale using transparent rules rather than black-box AI predictions.
  - Factors: Defect severity weight, aging hours, spatial clustering within 500m radius, corridor risk, and citizen reopen flags (+20 points).
- **Transparent Rationale Breakdown**: Every priority score displays its explicit derivation (e.g., `Critical severity (+40) + Reopened (+20) + 5 days aging (+12)`).
- **Priority Tiering**: Clear color-coded badges for `CRITICAL` (≥75), `HIGH` (50–74), `MEDIUM` (25–49), and `LOW` (<25).
- **Top Priority Actions Panel**: Dedicated "What should we act on first?" section highlighting top unresolved cases requiring emergency dispatch.

---

### 4. Complaint Operations & Queue
- **FilterBar Controls**: Granular server-side filtering across Category, Severity, Status, Department, Priority Level, Aging Bucket, and Reopened Status.
- **Dual View Layout**: Flexible split-pane layout switching between GIS Map and tabular Complaint Queue.
- **Responsive Table Controls**: Column sorting by Report ID, Category, Priority Score, Aging, Status, and Date.
- **Batch Reset & Refresh**: Reset button to quickly restore baseline views without clearing active authentication.

---

### 5. Assignment & Squad Dispatch
- **Department Reallocation**: Assign complaints to municipal departments (Municipal Roads / PWD, Solid Waste Management, Water Supply & Sewerage, Street Lighting).
- **Officer & Squad Assignment**: Direct dispatch to specific field teams (e.g., `Officer Verma (Rapid Patch Squad)`).
- **Dispatch Notes**: Optional dispatch instructions (e.g., emergency night milling required).
- **Auditable Assignment History**: Non-overwriting history log tracking previous assignees, reassignment timestamps, and authorizing officers.

---

### 6. Confidential Internal Notes
- **Strict Authority Isolation**: Internal notes are stored with role-restricted permissions and never returned to citizen-facing endpoints.
- **Privacy Badging**: Prominently marked in the drawer with `Confidential • Officers Only` visual indicators.
- **Operational Auditing**: Records author name, role, timestamp, and note content for internal Defect Liability Period (DLP) tracking and contractor accountability.

---

### 7. Citizen Status Requests
- **Citizen Inquiry Queue**: Dedicated queue surfacing citizen inquiries regarding delayed or in-progress complaints.
- **Authority Acknowledgment**: Officers can respond with status progress notes (e.g., `De-siltation team arrived on site`).
- **Lifecycle Preservation**: Acknowledging an inquiry communicates progress to the citizen without prematurely altering the complaint lifecycle status.

---

### 8. Escalation Center
- **Automated Escalation Triggers**: Highlights cases needing senior intervention based on deterministic criteria:
  - Cases reopened by citizens following failed repairs.
  - High-priority complaints unresolved beyond SLA thresholds (>3 days).
  - Unacknowledged citizen status inquiries.
- **Explicit Escalation Rationale**: Displays clear operational reasons explaining why each case was escalated.

---

### 9. Resolution Workflow & Proof Verification
- **Evidence-Based Resolution**: Enforces mandatory upload of verifiable photograph evidence before marking a complaint `RESOLVED`.
- **Supported Formats & Size**: JPG, PNG, WEBP formats up to 10 MB.
- **Resolution Modal**: Requires operational resolution note detailing actions taken.
- **Before / After Comparison**: Renders citizen intake photograph side-by-side with municipal repair evidence.
- **Immutable Timeline**: Appends resolution timestamp, photo link, and resolving officer credentials to the complaint audit trail.

---

### 10. Governance Analytics & Trust
- **Outcome Metrics**:
  - First-Time Resolution Rate.
  - Citizen Verification & Satisfaction Rate.
  - Average Response & Turnaround Times.
- **Zero-Fabrication Guarantee**: Displays explicit `"Insufficient data"` fallbacks when sample sizes are inadequate, preventing fabricated zeroes.
- **Department Performance & Workload**: Tracks active workload vs resolved throughput per department without arbitrary scoring metrics.
- **Aging Analysis**: Distributes unresolved cases across standard municipal time buckets (0–24h, 1–3d, 3–7d, 7+d).

---

### 11. Safe CSV Export
- **RBAC Enforcement**: Restricted to authenticated authority users with valid JWT bearer tokens.
- **Filter-Aware Streaming**: Exports exactly the active filtered dataset.
- **Privacy & Security Protection**: Excludes confidential internal notes, officer personal notes, and authentication secrets.
- **Standardized Filename**: Formatted as `complaints_export_YYYYMMDD_HHMMSS.csv`.

---

### 12. Security & Hardening
- **JWT-Based RBAC**: Supabase Auth tokens verified server-side on all administrative endpoints.
- **Data Redaction**: Public endpoints (`GET /api/complaints`, `GET /api/complaints/{id}`) automatically strip internal notes for anonymous or citizen callers.
- **Mutation Safety**: Double-click prevention, button loading indicators, and graceful error handling on API rejections.
- **CORS Lockdown**: Backend accepts configured production origins without wildcard credentials risks.
