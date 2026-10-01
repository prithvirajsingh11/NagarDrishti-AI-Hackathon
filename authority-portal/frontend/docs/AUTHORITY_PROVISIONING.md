# NagarDrishti AI - Municipal Authority Provisioning Guide

## Overview

The **NagarDrishti AI Authority Portal** is restricted exclusively to authorized municipal officers, ward engineers, and civic decision-makers.

To prevent unauthorized access:
- Public signup is **strictly disabled** (`/signup` does not exist for the Authority Portal).
- Users cannot select or elevate their own role.
- Roles are verified directly against the Supabase `profiles` table and validated on every backend request via Supabase JWT access tokens.

---

## Architecture & Security Model

```
Authority User (Email + Password)
          ↓
Supabase Auth (signInWithPassword)
          ↓
Supabase JWT Access Token
          ↓
Backend /api/auth/me (Bearer Token)
          ↓
Supabase Database: `profiles` table
          ↓
Role: `authority`?
    ├── YES → Access Granted (Command Center, Queue, Map, Hotspots)
    └── NO  → Redirected to `/access-denied` (Forbidden 403 on API)
```

---

## Approved Methods to Provision Authority Accounts

### Method 1: Supabase Dashboard (Recommended for Administrators)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication → Users**.
3. Click **Add User → Create User** (enter officer's email address and a temporary secure password).
4. Copy the generated `User UID` (UUID).
5. Navigate to the **SQL Editor** and run:

```sql
-- Ensure profile exists with 'authority' role
INSERT INTO public.profiles (user_id, role, full_name)
VALUES (
  'PASTE_OFFICER_USER_UUID_HERE',
  'authority',
  'Municipal Officer Name'
)
ON CONFLICT (user_id)
DO UPDATE SET
  role = 'authority',
  full_name = EXCLUDED.full_name;
```

---

### Method 2: Elevating an Existing Citizen Account to Authority

If an officer already has an account in the system:

```sql
UPDATE public.profiles
SET role = 'authority'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'officer@municipal.gov'
);
```

To verify the role assignment:

```sql
SELECT u.id, u.email, p.role, p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'officer@municipal.gov';
```

---

### Method 3: Automated Testing & CI/CD Tokens

For automated tests and backend verification, the shared FastAPI backend supports dedicated deterministic mock tokens:

- **Authority Test Token**: `test-authority-token`
  - Associated Identity: `officer@municipal.gov`
  - Role: `authority`
- **Citizen Test Token**: `test-citizen-token`
  - Associated Identity: `citizen1@example.com`
  - Role: `citizen` (automatically rejected with `403 Forbidden` from authority endpoints)

---

## Role Enforcement Checklist

| Action / Resource | Citizen Role | Authority Role |
| :--- | :--- | :--- |
| Authority Portal UI (`/dashboard`, `/reports`, `/map`, `/hotspots`) | ❌ Redirected to `/access-denied` | ✅ Full Access |
| `GET /api/dashboard/statistics` | ❌ 403 Forbidden | ✅ 200 OK |
| `GET /api/dashboard/heatmap` | ❌ 403 Forbidden | ✅ 200 OK |
| `GET /api/dashboard/hotspots` | ❌ 403 Forbidden | ✅ 200 OK |
| `PATCH /api/complaints/{id}/status` | ❌ 403 Forbidden | ✅ 200 OK |
| `GET /api/complaints` | Returns own complaints only | Returns all citywide complaints |
