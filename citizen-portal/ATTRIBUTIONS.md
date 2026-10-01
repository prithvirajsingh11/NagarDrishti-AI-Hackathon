# ATTRIBUTIONS & THIRD-PARTY LICENSES

**Project:** NagarDrishti AI  
**Tagline:** AI-Powered Civic Intelligence  
**License:** MIT License  

This document provides transparent attribution and licensing disclosures for all external frameworks, cloud services, libraries, and resources used in the development of NagarDrishti AI.

---

## 1. Cloud & AI Providers

### Google Gemini API
- **Provider:** Google DeepMind / Google Cloud
- **Purpose:** Multimodal visual intelligence for identifying civic infrastructure damage (potholes, garbage, streetlights, drains) from photographs.
- **Access Pattern:** Server-side proxy through FastAPI backend exclusively; client application never exposes API keys.
- **Terms:** [Google Generative AI Terms of Service](https://ai.google.dev/terms)

### Supabase
- **Provider:** Supabase, Inc.
- **Components:**
  - Supabase PostgreSQL (Structured complaint storage, departmental catalogs, spatial indices)
  - Supabase Storage (Private, controlled-access bucket `complaint-images` with backend tokenized/streamed proxying)
- **License:** Apache License 2.0 / PostgreSQL License
- **Reference:** [https://supabase.com](https://supabase.com)

---

## 2. Core Backend Technologies

### FastAPI
- **Author:** Sebastián Ramírez
- **License:** MIT License
- **Purpose:** Asynchronous REST API framework powering complaint intake, status transitions, and analytics.
- **Reference:** [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com)

### Pydantic & Pydantic-Settings
- **Author:** Samuel Colvin & Pydantic contributors
- **License:** MIT License
- **Purpose:** Schema enforcement, request validation, and environment configuration management.

### Google GenAI SDK (`google-genai`)
- **Author:** Google LLC
- **License:** Apache License 2.0
- **Purpose:** Official Python client library for Gemini multimodal inference.

### Pillow (PIL)
- **Author:** Alex Clark & Pillow contributors
- **License:** HPND License
- **Purpose:** Image integrity verification, MIME inspection, and metadata sanitization.

### Uvicorn
- **Author:** Encode OSS Ltd
- **License:** BSD 3-Clause License
- **Purpose:** High-performance ASGI web server.

---

## 3. Core Frontend Technologies

### React
- **Author:** Meta Platforms, Inc. & open source contributors
- **License:** MIT License
- **Purpose:** Declarative user interface library.

### Vite
- **Author:** Evan You & Vite contributors
- **License:** MIT License
- **Purpose:** Frontend tooling and build pipeline.

### TypeScript
- **Author:** Microsoft Corporation
- **License:** Apache License 2.0
- **Purpose:** Static type checking and domain model definitions.

### Tailwind CSS
- **Author:** Tailwind Labs Inc.
- **License:** MIT License
- **Purpose:** Modern responsive styling framework.

### Leaflet & OpenStreetMap
- **Leaflet:** Vladimir Agafonkin & contributors (BSD 2-Clause License)
- **OpenStreetMap Data:** OpenStreetMap contributors (Open Database License - ODbL)
- **Purpose:** Interactive geospatial mapping, location pinning, and severity-weighted density visualization.

### Lucide React
- **Author:** Lucide contributors
- **License:** ISC License
- **Purpose:** Crisp, professional vector icons for civic problem domains and statuses.

### Recharts
- **Author:** Recharts Group
- **License:** MIT License
- **Purpose:** Analytical charts for municipal reporting metrics.

---

## 4. Mobile Integration

### Capacitor
- **Author:** Ionic / Drifty Co.
- **License:** MIT License
- **Purpose:** Cross-platform native runtime enabling the React web application to run on Android devices.
- **Reference:** [https://capacitorjs.com](https://capacitorjs.com)

---

## 5. Sample Photographic Assets

Demonstration photographs utilized for offline testing and sample previews are sourced under the Unsplash Open License:
- Pothole road damage: Photo via Unsplash (free commercial and non-commercial civic showcase)
- Municipal waste accumulation: Photo via Unsplash
- Urban lighting infrastructure: Photo via Unsplash
- Stormwater drainage channel: Photo via Unsplash
