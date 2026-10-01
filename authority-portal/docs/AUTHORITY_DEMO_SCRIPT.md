# NagarDrishti AI — Authority Portal Demo Script

**Target Duration**: 2.5 – 3 minutes  
**Presenter Role**: Municipal Command Center Chief Operator  
**Audience**: Hackathon Evaluation Jury & Municipal Stakeholders  

---

### [00:00 – 00:20] Opening & Core Thesis
> *"From the municipal side, NagarDrishti AI converts incoming citizen complaints into actionable, auditable operational cases. Instead of an unorganized inbox, city administrators get a centralized Command Center with deterministic prioritization, GIS spatial intelligence, and transparent lifecycle tracking."*

- **Visual**: Show the **Command Center** dashboard (`http://localhost:5174`).
- **Key Points**:
  - Point to top **Lifecycle Pipeline Ribbon** (Citizen Report → Vision AI → Authority Triage → Assignment → Resolution → Citizen Verification).
  - Note the real-time KPI overview: Total Complaints, In Progress, Resolved, Citizen Reopened cases.

---

### [00:20 – 00:45] GIS Spatial Intelligence & Priority Actions
> *"Here on our interactive GIS map, we see geo-tagged complaints across city sectors. Notice that Bhopal is our default operational viewport, but India-wide coordinate bounds are fully supported."*

- **Actions**:
  - Toggle between **Markers**, **Clusters**, and **Heatmap** modes using the top-right toolbar.
  - Switch intelligence overlay to **Top Priority** or **Hotspots**.
  - Point to the **Priority Actions** card ("What should we act on first?"). Explain that priority scores are not black-box predictions; they combine severity weights, unresolved aging days, local incident clustering, and citizen feedback.

---

### [00:45 – 01:25] Complaint Deep-Dive & Municipal Dispatch
> *"Let's drill down into an urgent complaint. Clicking any pin on the map or row in the queue opens the Complaint Drawer."*

- **Actions**:
  - Click an urgent complaint (e.g. `NGD-2026-BHOPAL` or road crater).
  - Highlight the clear visual separation between:
    1. **Citizen-Visible Data**: Category, citizen photo, GPS coordinates, report timestamp.
    2. **Priority Explanation**: Why this case is ranked high.
  - **Case Assignment**:
    - Select Department: `Municipal Roads (PWD)`.
    - Input Officer: `Officer Verma (Rapid Response Team)`.
    - Click **Assign Case**.
    - Point out that assignment updates optimistically and logs directly into the immutable audit history.
  - **Confidential Internal Note**:
    - Under *Internal Authority Notes*, show the purple confidentiality badge: `Confidential • Officers Only`.
    - Type note: `"Contractor Defect Liability Period (DLP) expires in 60 days. Prioritize before warranty expiry."`
    - Submit note and point out: *This note is strictly blocked from citizen endpoints by server-side RBAC.*

---

### [01:25 – 01:55] Status Progression & Resolution with Photo Evidence
> *"Municipal governance requires verifiable proof of resolution, not just a checkbox."*

- **Actions**:
  - Move complaint status to **In Progress**.
  - Click **Mark as Resolved**.
  - Demonstrate the **Resolution Confirmation Modal**:
    - Select a repair evidence photograph (JPG/PNG/WEBP under 10 MB).
    - Enter resolution note: `"Pothole milled and patched with cold-mix bitumen. Leveling completed."`
    - Submit resolution.
  - Point out the **Before / After Comparison View** rendered immediately in the drawer:
    - Left: Citizen intake photograph.
    - Right: Municipal resolution proof with timestamp.

---

### [01:55 – 02:30] Citizen Verification, Reopens & Escalation Center
> *"The lifecycle doesn't end when the authority clicks resolve. The citizen verifies the work on-site."*

- **Actions**:
  - Show a complaint marked with the high-visibility **Reopened** badge.
  - Explain: *"When a citizen reports that a repair failed or was incomplete, the complaint transitions to REOPENED with explicit citizen feedback."*
  - Scroll to the **Escalation Center**:
    - Point out escalated cases flagged with transparent operational reasons (e.g., `Citizen Reopened Case`, `High Priority & Aging > 3 Days`, `Pending Citizen Status Inquiry`).
    - Show the **Citizen Status Inquiries Queue** where officers can acknowledge citizen requests with progress notes without breaking lifecycle status.

---

### [02:30 – 03:00] Governance Analytics & Safe Data Export
> *"Finally, city leaders need evidence-based governance analytics, not fabricated vanity numbers."*

- **Actions**:
  - Scroll through **Governance Outcomes**: First-Time Resolution Rate, Citizen Verification Rate, SLA compliance.
  - Point out the fallback indicators: when historical samples are zero, the dashboard shows `"Insufficient data"` instead of misleading 0% metrics.
  - Click **Export CSV** on the FilterBar:
    - Point out that the exported file is filtered to the active view and completely strips confidential internal notes and user credentials.

---

### Conclusion
> *"NagarDrishti AI Authority Portal connects citizen reports with verifiable municipal execution. Every score has a formula, every resolution requires proof, and every citizen retains the right to verify."*
