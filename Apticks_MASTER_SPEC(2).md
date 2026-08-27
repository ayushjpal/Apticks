# Apticks Master Specification: Authentication & User Onboarding Flow
**Document Version:** 2.1  
**Status:** Approved Architecture Specification  
**Scope:** Authentication, User Identity, Profile Linking, and Onboarding

---

## 1. Executive Summary & Principles

Apticks uses a streamlined, user-first authentication and onboarding architecture. The primary identity for every user across Apticks is their unique **Username** (handle), while **Email** is an optional account recovery and verification attribute.

### Core Architectural Rules:
- **Primary Auth Provider:** Supabase Auth (with PostgreSQL Database & Edge Functions).
- **Single Identity per User:** Every user (whether created via Username/Password or OAuth Google/GitHub) has exactly one Supabase `auth.users` UUID mapping 1-to-1 with a `public.profiles` row.
- **Zero Email Exposure:** Real user emails are strictly private and never exposed to the frontend through public database queries, RPCs, or client-side resolution.
- **No Anonymous-User Conversion Overhead:** Users registering with Username + Password immediately receive a permanent account and land directly on the Dashboard.
- **No Dual-Password Signup UX:** Signup forms collect **only ONE password field**, labeled `"Confirm Password"`. There is no redundant duplicate password entry during account creation.
- **In-App OTP Verification for Email:** Adding an email from the user profile uses an in-app verification code / OTP flow (no forced redirect link jumping).
- **Preserved Custom Design System:** All authentication interfaces adhere strictly to the custom Apticks neo-brutalist aesthetic with floating geometric/clock elements, high-contrast borders, bold typography, and micro-interactions.

---

## 2. Authentication Paths

There are three primary authentication entry points:
1. **Existing user → Username + Password**
2. **Existing / New user → Google OAuth**
3. **Existing / New user → GitHub OAuth**

```
                       ┌─────────────────────────────────┐
                       │      APTICKS AUTHENTICATION     │
                       └────────────────┬────────────────┘
                                        │
        ┌───────────────────────────────┼──────────────────────────────┐
        ▼                               ▼                              ▼
┌───────────────┐               ┌───────────────┐              ┌───────────────┐
│  USERNAME +   │               │    GOOGLE     │              │    GITHUB     │
│   PASSWORD    │               │     OAUTH     │              │     OAUTH     │
└───────┬───────┘               └───────┬───────┘              └───────┬───────┘
        │                               │                              │
        │                               └──────────────┬───────────────┘
        │                                              ▼
        │                               ┌──────────────────────────────┐
        │                               │ Supabase Auth (Native OAuth) │
        │                               └──────────────┬───────────────┘
        │                                              │
        │                                              ▼
        │                               ┌──────────────────────────────┐
        │                               │ Profile exists with handle?  │
        │                               └───────┬──────────────┬───────┘
        │                                  YES  │              │ NO
        │                                       │              ▼
        │                                       │      ┌───────────────┐
        │                                       │      │/choose-username│
        │                                       │      └───────┬───────┘
        │                                       │              │ Set Username
        │                                       ▼              ▼
        │                               ┌──────────────────────────────┐
        │                               │          DASHBOARD           │
        ▼                               └──────────────────────────────┘
┌────────────────────────────────┐
│ Edge Function:                 │
│ - signup-with-username         │
│ - login-with-username          │
└───────────────┬────────────────┘
                ▼
┌────────────────────────────────┐
│          DASHBOARD             │
└────────────────────────────────┘
```

---

## 3. Detailed Flow Specifications

### 3.1. Username + Password Signup Flow

- **Inputs Collected:**
  - `Username` (text)
  - `Confirm Password` (password, single input field)
- **Validation Rules:**
  - Username: 3–20 characters, lowercase alphanumeric + `_`, `-`, `.`, no leading/trailing separators, no consecutive separators.
  - Password: Min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
  - Live debounced check verifies username availability in real-time.
- **Signup UX Rule:**
  - Only ONE password field is rendered, intentionally labeled `"Confirm Password"`.
  - Do NOT render a separate `"Password"` field or ask the user to type the password twice.
  - Email is **NOT** collected during initial signup.
- **Backend Flow:**
  1. Frontend submits `{ username, password }` to the secure `signup-with-username` Edge Function.
  2. Edge Function verifies username availability against `public.profiles`.
  3. Edge Function provisions the `auth.users` identity and creates the `public.profiles` row (`id`, `username`, `display_name`).
  4. Edge Function generates authenticated session tokens (`access_token`, `refresh_token`).
  5. Frontend receives the session tokens, calls `supabase.auth.setSession()`, and immediately routes to `/dashboard`.

---

### 3.2. Username + Password Login Flow

- **Inputs Collected:**
  - `@ username` (text)
  - `Password` (password)
- **Login UX Rule:**
  - Username-first sign-in (never requires user to remember or enter email).
  - Secondary minimal buttons for `[ G Continue with Google ]` and `[ GitHub ]`.
  - Link to `/forgot-password`.
- **Backend Flow:**
  1. Frontend sends `{ username, password }` to `login-with-username` Edge Function.
  2. Edge Function performs server-side identity resolution in a single isolated step using the Supabase Service Role key (without exposing user email to the public or client).
  3. Authenticates password against Supabase Auth.
  4. Returns authenticated `{ session, user }` to the client.
  5. Client sets the session and navigates directly to `/dashboard`.

---

### 3.3. OAuth Authentication (Google & GitHub) Flow

- **Entry Points:** Available on both Login and Signup screens via minimal neo-brutalist buttons.
- **Existing OAuth User:**
  1. User authenticates with Google / GitHub.
  2. Redirected to `/auth/callback`.
  3. Supabase Auth session established.
  4. Profile check finds existing profile with non-null `username`.
  5. User redirected directly to `/dashboard`.
- **New OAuth User:**
  1. User authenticates with Google / GitHub.
  2. Redirected to `/auth/callback`.
  3. Supabase Auth session established.
  4. Profile check detects NO username configured yet.
  5. User redirected to `/choose-username`.
  6. User enters unique username with live real-time validation.
  7. Form submits and updates `public.profiles` row with `username`.
  8. User redirected to `/dashboard`.
- **Crucial Rule:** The OAuth account and Apticks profile remain ONE single account with the same `auth.users.id`. No duplicate account creation.

---

### 3.4. Optional Email Linking & In-App OTP Verification Flow

Email is an optional account attribute for users who initially registered with Username + Password.

- **Location:** Dashboard → Profile → Account Security & Email section.
- **States:**
  - **Unlinked State:** Displays `Email: Not linked` with `[ Add Email ]` button.
  - **Verification In-Progress:** Displays `Verification code sent to user@example.com` with a 6-digit OTP input dialog and `[ Verify Code ]` button.
  - **Verified State:** Displays `Email: u***@example.com ✓ Verified` with optional `[ Change Email ]` button.
- **OTP Verification Protocol:**
  1. User clicks `[ Add Email ]` and enters their real email (e.g., Gmail).
  2. System initiates email update and triggers a 6-digit OTP code to the email address.
  3. Apticks renders an in-app OTP input modal.
  4. User reads code from Gmail, enters the code in Apticks.
  5. Client calls OTP verification (`supabase.auth.verifyOtp({ email, token, type: 'email_change' })`).
  6. Email is confirmed and marked verified.

---

### 3.5. Password Recovery Flow

- **Entry Point:** `/forgot-password` (accessible from Login screen).
- **Input:** Username or Email.
- **Account without Verified Email:**
  - If a user registered with Username/Password and has not linked a verified email:
  - System safely responds: *"Add and verify an email from your Profile to enable account recovery."*
  - Does not pretend an email was sent.
- **Account with Verified Email:**
  - Edge Function `request-password-reset` resolves the account server-side without exposing email.
  - Triggers a secure password reset link to the verified email.
  - Returns safe, generic success message: *"If an account exists with a verified email, a password reset link has been sent."*
  - User clicks link, lands on `/update-password`, submits new password.

---

## 4. Canonical Username System Specifications

- **Storage:** Stored in `public.profiles.username` in canonical lowercase.
- **Length:** 3 to 20 characters.
- **Allowed Characters:** `a-z`, `0-9`, `_`, `-`, `.`
- **Separator Rules:**
  - Cannot start with a separator (`.`, `_`, `-`).
  - Cannot end with a separator (`.`, `_`, `-`).
  - Cannot have consecutive separators (`..`, `__`, `--`, `._`, `_.`, etc.).
- **Uniqueness Authority:** Database-level `CREATE UNIQUE INDEX idx_profiles_username_lower ON public.profiles (LOWER(TRIM(username)))`.
- **Cooldown Rule:** Username changes in Profile are rate-limited to once every 14 days (`username_changed_at` timestamp check).

---

## 5. Security & Isolation Invariants

1. **No Service-Role Key on Client:** Frontend code only accesses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key).
2. **No Public Username-to-Email Resolvers:** No RPC or public table exposes another user's email address.
3. **Fail-Closed Authentication Errors:** Generic error messages prevent user account enumeration.
4. **Row Level Security (RLS):**
   - `public.profiles`: Anyone can read public profile data (`username`, `display_name`, `avatar_url`, `bio`); only the owner (`auth.uid() = id`) can insert or update.
5. **No Anonymous Account Bloat:** Anonymous authentication is completely removed from the signup path.

---

## 6. Preservation of Downstream Modules

All downstream features map to `public.profiles.id` (which is `auth.users.id`) and continue to function seamlessly:
- **Dashboard:** Reads user profile and displays `WELCOME BACK, @username`.
- **Question Bank & Solver:** Records progress in `public.user_question_progress` by `user_id`.
- **Leaderboards & Contests:** Joins with `public.profiles` on `id` to display avatars, display names, and `@username`.
- **Profile Page:** Full profile management with live athlete preview card.
