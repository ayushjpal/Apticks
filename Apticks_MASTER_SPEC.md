# Aptiverse — AI Handoff / Master Project Specification

> This document is the single source of truth for any AI, developer, or coding agent working on Aptiverse.
> Read this file completely before modifying the project.
> Do not redesign the architecture without explaining the reason and getting approval.

---

## 1. Project Overview

**Project name:** Aptiverse

Aptiverse is a production-quality aptitude contest and competitive quiz web application.

The platform combines:

- Aptitude practice
- Competitive contests
- Timed tests
- Leaderboards
- XP and levels
- Achievements/badges
- Friends
- 1v1 aptitude battles
- User profiles
- Question creation/moderation
- Notifications
- Admin/moderation tools

The goal is to build a polished, portfolio-level application rather than a simple demo.

---

## 2. Technology Stack

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- React Hook Form
- Zod

### Backend / Database

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions / secure RPC where appropriate
- Supabase Realtime for realtime features such as 1v1

### UI / Animation

- GSAP
- Lenis
- Brutalist + Glassmorphism visual direction
- Dark-first design
- Animated typography
- Smooth transitions
- Micro-interactions
- Responsive/mobile-friendly UI

### Development

- VS Code
- Node.js
- npm
- Git/GitHub

---

# 3. Core Development Rules

Any AI working on Aptiverse must follow these rules.

1. Use TypeScript everywhere.
2. Do not use plain JavaScript unless absolutely necessary.
3. Do not modify unrelated files.
4. Do not install unnecessary dependencies.
5. Do not rebuild existing functionality without a reason.
6. Reuse existing components and utilities where possible.
7. Keep code modular and maintainable.
8. Keep secrets out of frontend source code.
9. Never expose Supabase service-role credentials in the browser.
10. Never store passwords manually in application tables.
11. Supabase Auth manages authentication credentials and password hashing.
12. Use Row Level Security (RLS) for Supabase public tables.
13. Frontend validation is for UX; database/server validation is required for security.
14. Never trust client-side authorization.
15. Before making major architectural changes, explain the change and its reason.
16. Do not implement multiple unrelated modules in one step.
17. After every major module, provide a testing checklist.
18. Fix errors before moving to the next module.
19. Preserve the database architecture unless a justified change is approved.
20. Prefer secure, simple solutions over premature over-engineering.

---

# 4. Authentication System

## Login Methods

Aptiverse must support:

### A. Username + Password

User enters:

- Username
- Password

The username is securely resolved to the user's authentication identity and then authenticated through Supabase Auth.

Important:

- Do NOT expose user emails through a public username lookup.
- Use a secure server-side approach such as an appropriate Supabase Edge Function and/or secure RPC.
- Password authentication remains managed by Supabase Auth.

Flow:

username + password
→ secure username resolution
→ Supabase Auth authentication
→ Supabase session
→ dashboard

### B. Google OAuth

- Continue with Google
- Supabase OAuth
- Existing user → dashboard
- New user → username/profile onboarding if required

### C. GitHub OAuth

- Continue with GitHub
- Supabase OAuth
- Existing user → dashboard
- New user → username/profile onboarding if required

---

## Signup

Fields:

- Email
- Username
- Password
- Confirm Password

Signup flow:

1. Validate username.
2. Validate password.
3. Check username availability.
4. Create Supabase Auth user.
5. Create/link profile.
6. Send email verification.
7. User verifies email.
8. User can log in.

---

# 5. Username System — FINAL RULES

Username is globally unique.

### Allowed

- Lowercase letters: `a-z`
- Numbers: `0-9`
- Dot: `.`
- Underscore: `_`
- Hyphen: `-`

### Length

3–20 characters.

### Must NOT

- Contain spaces.
- Contain uppercase letters in stored/canonical form.
- Contain other special characters.
- Start with `.`, `_`, or `-`.
- End with `.`, `_`, or `-`.
- Contain consecutive separators such as:
  - `..`
  - `__`
  - `--`
  - `._`
  - `_.`
  - `.-`
  - `-.`
  - `_ -` equivalents without spaces.

### Examples — valid

- `ayush`
- `ayush07`
- `ayush_07`
- `ayush.dev`
- `ayush-pal`
- `ayush_07.dev`

### Examples — invalid

- `Ayush`
- `ayush pal`
- `ayush@07`
- `.ayush`
- `ayush_`
- `ayush..dev`

### Normalization

If a user types:

`Ayush_07`

normalize to:

`ayush_07`

Store canonical lowercase.

### Enforcement

Username rules must be enforced at:

1. Frontend validation
2. Backend/server validation
3. PostgreSQL/database constraint
4. Database-level unique index/constraint

Two users must never be able to claim the same username.

---

# 6. Password System

Password requirements:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

Real-time UI:

- Green check when a rule is satisfied.
- Red indication when a rule is not satisfied.
- Disable signup until required validation passes.

Additional features:

- Show/hide password
- Confirm password
- Forgot password
- Password reset
- Change password
- Email verification
- Session persistence
- Logout
- Protected routes
- Loading/error/success states

Passwords must NEVER be stored manually in `profiles` or any other application table.

---

# 7. User Profile Module

Profile table is linked 1:1 to `auth.users`.

Profile features:

- Username
- Display name
- Bio
- Profile picture
- Cover image
- College
- Branch
- Academic year
- GitHub URL
- LinkedIn URL
- Role
- XP
- Level
- Current streak
- Maximum streak
- Ban status
- Created/updated timestamps

Profile functionality:

- View own profile
- Edit own profile
- Public profile
- Change username
- Upload avatar
- Upload cover
- Update bio
- Update education information
- Update social links

Users can modify only fields they are authorized to modify.

Role, XP, level, and moderation fields must not be freely editable by the client.

---

# 8. Aptitude Question System

## Categories

Examples:

- Quantitative Aptitude
- Logical Reasoning
- Verbal Ability
- Technical / CS

## Topics

Examples:

- Percentages
- Time & Work
- Number Series
- Reading Comprehension
- etc.

## Questions

Question properties:

- Topic
- Creator
- Prompt
- Optional code snippet
- Difficulty
- Explanation
- Tags
- XP reward
- Status
- Reviewer
- Rejection reason
- Created/updated timestamps

Difficulty:

- Easy
- Medium
- Hard

Question status:

- Draft
- Pending review
- Approved
- Rejected

## Question Options

Each question supports multiple-choice options.

Store:

- Question ID
- Option text
- Option order
- Correct-answer flag

Correct answers must not be exposed to clients during active competitive contests.

Use secure RPC/database functions or a secure data-access design for contest answer submission/evaluation.

---

# 9. Contest System

A single `contests` model should support:

- Daily
- Weekly
- Custom
- Special contests

Contest fields include:

- Title
- Slug
- Description
- Banner
- Type
- Status
- Start time
- End time
- Duration
- Total marks
- Negative marking ratio
- Public/private state
- Creator
- Timestamps

Contest statuses:

- Draft
- Upcoming
- Active
- Ended
- Cancelled

Contest questions are stored through a junction table.

Each contest question has:

- Contest ID
- Question ID
- Order
- Marks
- Negative marks

---

# 10. Contest Participation

A participant record tracks:

- Contest
- User
- Registration time
- Start time
- Submission time
- Score
- Accuracy
- Correct answers
- Wrong answers
- Unattempted questions
- Time taken
- Final rank
- Status

Participant statuses:

- Registered
- In progress
- Completed
- Disqualified

A user can register only once for a contest.

Contest answer records track:

- Participant
- Question
- Selected option
- Correctness
- Score awarded
- Time spent
- Answer time

Contest answer writes/evaluation should use secure RPC/database functions where appropriate.

---

# 11. Leaderboards

Aptiverse needs:

### Global leaderboard

Based primarily on XP/ranking.

### Contest leaderboard

Based on:

1. Score
2. Time taken as a tie-breaker

Store final rank for completed contests when appropriate.

Leaderboard queries must be indexed.

---

# 12. Practice Mode

Users can practice questions outside contests.

Track:

- User
- Question
- Selected option
- Correctness
- Time spent
- Timestamp

Use practice history for:

- Accuracy statistics
- Weak-area analytics
- Question history
- Progress tracking

Practice attempts should be immutable from the normal client after creation.

---

# 13. Bookmarks

Users can bookmark questions.

Features:

- Add bookmark
- Remove bookmark
- Optional personal note
- View bookmarked questions

A user should not be able to create duplicate bookmarks for the same question.

---

# 14. Gamification

## XP

Maintain an immutable XP transaction ledger.

XP sources can include:

- Daily contests
- Custom contests
- Practice
- Achievements
- 1v1 matches
- Daily streaks
- Admin adjustments

XP changes should be performed through trusted server/database logic.

Users must not be able to directly award themselves XP.

## Levels

Profile stores current level.

Level should be derived/updated from trusted XP logic.

## Achievements

Achievement definition contains:

- Code
- Title
- Description
- Category
- Badge icon
- XP reward
- Criteria type
- Criteria threshold
- Active state

User achievements record when a user unlocks an achievement.

A user should not unlock the same achievement multiple times unless the future design explicitly supports repeatable achievements.

---

# 15. Friends / Social System

## Friend Requests

Use a friendship relationship supporting:

- Pending
- Accepted
- Rejected

Prevent:

- Self requests
- Unauthorized changes
- Duplicate relationships

Features:

- Send request
- Accept
- Reject
- Cancel
- Remove friend

## Blocking

Users can block other users.

Blocking should prevent appropriate interactions such as:

- Friend requests
- 1v1 challenges
- Other restricted social visibility/interactions

---

# 16. 1v1 System

Aptiverse supports real-time or async 1v1 aptitude battles.

Match data:

- Challenger
- Opponent
- Topic (optional)
- Status
- Number of questions
- Scores
- Time
- Winner
- Draw state
- XP wager if enabled
- Created/started/completed timestamps

Statuses:

- Waiting
- Accepted
- In progress
- Completed
- Declined
- Cancelled

Match answers track:

- Match
- User
- Question
- Selected option
- Correctness
- Time taken

Use Supabase Realtime with filtered channels rather than broad table subscriptions.

---

# 17. Notifications

In-app notifications should support:

- Friend request
- Friend accepted
- Contest starting
- Contest results
- 1v1 challenge
- Achievement unlocked
- System alert

Notification fields:

- User
- Type
- Title
- Message
- JSON metadata/data
- Read state
- Created timestamp

Users can:

- View their notifications
- Mark notifications read
- Delete their own notifications if appropriate

System-generated notifications should not be freely insertable by clients.

---

# 18. Moderation / Reports

Users can report:

- Users
- Questions
- Cheating/abuse
- Incorrect questions
- Spam
- Inappropriate content
- Other issues

Reports contain:

- Reporter
- Reported user (optional)
- Reported question (optional)
- Reason
- Description
- Status
- Reviewer
- Resolution notes
- Timestamps

Statuses:

- Pending
- Investigating
- Resolved
- Dismissed

Admin/moderator permissions must be enforced with RLS and trusted server-side logic.

---

# 19. Roles

Supported roles:

- User
- Moderator
- Admin

Normal users must not be able to change their own role.

Admin/moderator privileges must be protected through database/RLS logic, not merely frontend checks.

---

# 20. Recommended Database Tables

The current architecture contains these 20 public tables:

1. `profiles`
2. `categories`
3. `topics`
4. `questions`
5. `question_options`
6. `contests`
7. `contest_questions`
8. `contest_participants`
9. `contest_answers`
10. `question_attempts`
11. `bookmarked_questions`
12. `matches_1v1`
13. `match_1v1_answers`
14. `achievements`
15. `user_achievements`
16. `xp_transactions`
17. `friendships`
18. `user_blocks`
19. `notifications`
20. `user_reports`

Supabase-managed `auth.users` is separate and must not be recreated as a public table.

---

# 21. Supabase Storage

Recommended buckets:

### avatars

Path:

`{user_id}/avatar.webp`

### covers

Path:

`{user_id}/cover.webp`

### contest-banners

Path:

`{contest_id}/banner.webp`

### question-assets

Path:

`{question_id}/...`

Storage access must use Supabase Storage policies.

Users may upload/change only their own avatar/cover.

---

# 22. Security Architecture

Mandatory:

- RLS enabled on public tables.
- Secure profile ownership checks.
- Secure username uniqueness.
- Secure username-login resolution.
- No password storage in app tables.
- No service-role key in frontend.
- No trusting frontend role checks.
- Correct Storage policies.
- Correct OAuth configuration.
- Secure contest answer submission.
- Correct protection of correct answers.
- Server-side authorization for admin/moderator actions.
- Immutable history where appropriate.

---

# 23. RLS High-Level Rules

### profiles

- Public read for appropriate public profile fields.
- User can update own editable profile fields.
- User cannot modify role/XP/level/ban status directly.
- Admin can manage profiles according to policy.

### questions

- Authenticated users can view approved questions.
- Creators can manage their own drafts.
- Moderators/admins can review questions.

### contests

- Public users can see appropriate public contest information.
- Participants can access appropriate contest data.
- Contest management is restricted to authorized creators/moderators/admins.

### contest_answers

- Participant can access own answers according to contest state.
- Direct unsafe answer writes should be prevented where RPC is required.

### bookmarks / attempts

- Owner only.

### friendships

- Only involved users can access relationship records.

### blocks

- Blocker controls their block records.

### notifications

- User sees only their notifications.

### reports

- Reporter sees their own reports.
- Moderators/admins see reports they are authorized to investigate.

---

# 24. Visual Design Direction

Aptiverse should feel like a premium competitive gaming/SaaS platform.

### Style

- Brutalism
- Glassmorphism
- Dark-first
- Strong typography
- Clean layout
- Sharp/intentional borders
- Glass panels
- Subtle gradients
- Modern dashboard

### Animation

Use GSAP for:

- Hero text
- Staggered text
- Page transitions
- Micro-interactions
- Hover effects
- Magnetic buttons where useful
- Scroll-triggered reveals
- Loading animations

Use Lenis for smooth scrolling where appropriate.

Do not over-animate forms or critical interactions.

Animations must never reduce usability or accessibility.

---

# 25. UI/UX Requirements

Every major feature should include:

- Loading state
- Error state
- Empty state
- Success feedback
- Form validation
- Responsive layout
- Keyboard accessibility
- Appropriate focus states
- Mobile support

Use reusable components instead of duplicating UI.

---

# 26. Recommended Frontend Architecture

Suggested structure:

```text
src/
├── components/
├── pages/
├── layouts/
├── hooks/
├── lib/
│   └── supabase.ts
├── services/
├── animations/
├── types/
├── contexts/
├── routes/
├── utils/
├── App.tsx
└── main.tsx
```

Adapt this structure if the actual project architecture has a better justified organization.

---

# 27. Recommended Build Order

## Phase 0 — Planning

- Requirements
- Database architecture
- ERD
- Security model
- UI design system

## Phase 1 — Foundation

- Vite
- React
- TypeScript
- Tailwind
- ESLint
- Prettier
- Router
- Supabase client
- Environment variables

## Phase 2 — Identity

- Profiles
- Username system
- Username login
- Email/password
- Google OAuth
- GitHub OAuth
- Email verification
- Forgot/reset password
- Change password
- Protected routes
- Logout

## Phase 3 — Profile

- Public profile
- Edit profile
- Avatar
- Cover
- Bio
- Education
- Social links

## Phase 4 — Aptitude Core

- Categories
- Topics
- Questions
- Options
- Difficulty
- Tags
- Question moderation

## Phase 5 — Practice

- Practice questions
- Attempts
- Bookmarks
- Practice statistics

## Phase 6 — Contest

- Contest listing
- Contest details
- Registration
- Timer
- Contest questions
- Answer submission
- Scoring
- Results

## Phase 7 — Leaderboards

- Contest leaderboard
- Global leaderboard
- Rankings

## Phase 8 — Gamification

- XP
- Levels
- Streaks
- Achievements
- Badges

## Phase 9 — Social

- Friends
- Friend requests
- Blocks
- 1v1

## Phase 10 — Notifications

- In-app notifications
- Contest reminders
- Friend notifications
- Achievement notifications

## Phase 11 — Moderation

- Reports
- Moderator dashboard
- Admin dashboard
- Question review
- User moderation

## Phase 12 — Polish

- GSAP
- Lenis
- Page transitions
- Micro-interactions
- Accessibility
- Performance
- Responsive refinement

## Phase 13 — Testing & Deployment

- Unit tests where useful
- Integration testing
- Auth edge cases
- RLS testing
- Security review
- Performance review
- Production environment
- Deployment

---

# 28. AI Development Workflow

Any new AI joining the project must:

1. Read this file completely.
2. Inspect the existing codebase.
3. Inspect current database/migrations.
4. Determine which phases/modules are already complete.
5. Do not overwrite existing work.
6. Ask for clarification before changing architecture.
7. Work on one module at a time.
8. Explain changed files.
9. Run/build/test after implementation.
10. Report errors instead of hiding them.

When continuing work, use this format:

```text
Current Phase:
Current Module:
Already Implemented:
Current Task:
Files Expected To Change:
Database Changes:
Testing Required:
```

---

# 29. Current Project Status

At the time this document was created:

- Database architecture has been designed.
- The architecture contains 20 main public tables.
- Username requirements have been finalized.
- Username login is required.
- Google login is required.
- GitHub login is required.
- Email/password authentication is required.
- Profile module is required.
- The database schema should be reviewed before SQL migrations are generated.
- Frontend implementation should proceed only after the schema/security design is approved.

---

# 30. Important AI Instruction

DO NOT assume that a feature is implemented merely because it appears in this document.

This document describes the target architecture and requirements.

Always inspect the actual repository and Supabase migrations before claiming that something exists.

If the current code contradicts this document:

1. Explain the contradiction.
2. Do not silently overwrite it.
3. Propose the safest migration path.

---

# 31. First Task for a New AI

When a new AI receives this document, DO NOT immediately start coding.

First respond with:

1. What you understand about Aptiverse.
2. Which modules exist in the specification.
3. Which parts you found in the existing codebase.
4. Which parts are missing.
5. Any architectural conflicts.
6. The safest next implementation step.

Then wait for approval before making major changes.

---

# End of Aptiverse Master Specification
