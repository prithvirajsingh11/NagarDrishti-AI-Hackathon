# NagarDrishti AI: Hackathon Presentation & Demo Script

**Duration:** ~2.5 to 3 Minutes  
**Presenters:** 1 or 2 presenters (Citizen Journey + Authority Operations)

---

## Pitch Narrative Structure

### 1. Opening Problem (0:00 - 0:25)
> "Municipal complaints often vanish into black holes. Citizens report potholes, overflowing trash, or broken streetlights using clunky portals, wait weeks without updates, and have no way to verify if work was actually done. Municipal authorities are equally overwhelmed with unorganized complaints, duplicate reports, and no visual triage.
> 
> **NagarDrishti AI** bridges this gap: an AI-assisted civic intelligence platform where a single photo is analyzed, triaged, routed, tracked, and citizen-verified."

---

### 2. Citizen Experience: Photo & AI Analysis (0:25 - 1:05)
> *(Action: On Citizen Portal `http://localhost:5173`, click "Report a Civic Issue" or select a demo image, e.g., pothole or garbage).*
> 
> "As a citizen, filing a report takes seconds:
> 1. I snap or upload a photo of the road damage.
> 2. NagarDrishti AI instantly analyzes the image using multimodal AI.
> 3. Notice what happens: it identifies the problem as **Road Damage / Pothole** with **95% confidence**, evaluates the visual severity as **HIGH** based on detected asphalt crater depth, and automatically routes it to the **Municipal Roads Department**.
> 4. Notice the transparency: the system clearly labels this as an **AI-estimated visual assessment**. As a citizen, I maintain full control to review or edit details before submitting."

---

### 3. Location & Submission (1:05 - 1:25)
> *(Action: Show GPS location on Leaflet map, enter description, submit report).*
> 
> "GPS coordinates are automatically attached via browser geolocation or pin placement on the interactive map.
> 
> I click **Submit Complaint**. Instantly, the backend generates an official tracking ID — **`NGD-2026-00238`** — stores the image in private encrypted storage, and logs the complaint with full citizen ownership."

---

### 4. Authority Command Center: Triage & Assignment (1:25 - 1:55)
> *(Action: Switch to Authority Portal `http://localhost:5174` in another window or show live authority view).*
> 
> "Now let's switch to the municipal side. The Authority Command Center is a separate dedicated portal for civic administrators:
> 1. The complaint immediately appears in the real-time queue with its AI-assessed priority, aging indicator, and location corridor.
> 2. The GIS heat map highlights localized problem clusters, preventing separate crews from being dispatched blindly.
> 3. The supervisor assigns the task to a field engineer and transitions status to **IN PROGRESS**."

---

### 5. Resolution & Citizen Verification Loop (1:55 - 2:30)
> *(Action: Authority uploads repair photo and marks RESOLVED; switch back to Citizen 'My Reports').*
> 
> "Once repairs are completed, the field team uploads photographic proof of resolution and marks the report **RESOLVED**.
> 
> Here is what makes NagarDrishti AI truly accountable:
> 1. The citizen receives an immediate notification in their portal.
> 2. Under **My Reports**, the citizen inspects the authority's resolution proof side-by-side with their original submission.
> 3. If the fix is verified, the citizen clicks **Confirm Resolution**, locking the audit trail.
> 4. If the work was sloppy or incomplete, the citizen can click **Reopen Complaint** with a required explanation, pushing it right back to the authority backlog.
> 5. Any neighbor can also track progress anonymously via the public status tracker without exposing citizen PII."

---

### 6. Closing & Impact (2:30 - 2:50)
> "NagarDrishti AI transforms civic reporting from an opaque complaint box into a closed-loop, accountable partnership between citizens and city administration:
> - **Zero guess work:** Automated visual severity and smart routing.
> - **Zero duplicate waste:** Spatial corridor clustering.
> - **100% accountability:** Citizen-verified resolution evidence.
> 
> Thank you."

---

## Live Demo Quick Reference Cheatsheet

| Step | Action | Expected On-Screen Result |
|------|--------|--------------------------|
| **1. Login** | Log in with test citizen account | Citizen profile pill displays "Verified Citizen" badge |
| **2. Report** | Click "Report a Civic Issue" -> Upload photo | Image previews; AI progress spinner appears |
| **3. AI Triage** | Inspect detection card | Category: `Pothole`, Severity: `HIGH`, Dept: `Municipal Roads` |
| **4. Location** | View map pin / confirm location | Street address and coordinates populated |
| **5. Submit** | Click "Confirm & Submit" | Success screen with `NGD-2026-XXXXX` report ID |
| **6. My Reports** | Open "My Reports" tab | New report appears at top with `REPORTED` badge |
| **7. Public Tracker** | Enter report ID on Public Tracker | Shows current status timeline; citizen PII completely hidden |
| **8. Resolution** | View resolved complaint | Resolution image displayed; "Confirm Resolution" and "Reopen" buttons active |
