# Changelog

## Unreleased

### Database Integration — SQLite + Prisma

- Added the Prisma schema and SQLite datasource for students, schedules, sessions, attendance, and payments.
- Added a Prisma client singleton and repository layer.
- Seeded the database from the existing mock records while preserving domain IDs.
- Refactored services and server pages to read through repositories.

### Milestone 7 — Calendar

- Added a custom animated month-view calendar without a calendar library.
- Displayed generated sessions with student avatars and status styling.
- Added selected-day details for upcoming, completed, cancelled, attendance, and payment placeholder sections.
- Connected the calendar to session grouping and month-cell utilities.

### Milestone 6 — Session Engine Foundation

- Added typed session lifecycle records and generated recurring sessions for the current month.
- Added session queries for today, upcoming, past, student-specific, and individual sessions.
- Migrated attendance records to reference `sessionId`.
- Added upcoming and past session views to student profiles.
- Updated dashboard summaries and the right panel to use sessions.
- Added project roadmap, architecture, and contribution documentation.

### Milestone 5 — Payments Engine Foundation

- Added payment models, methods, statuses, and billing periods.
- Added payment services for balances, revenue, histories, pending students, and recent payments.
- Removed stored student pending-fee values.
- Added payment history and balance details to student profiles.
- Connected dashboard payment statistics to payment services.

### Milestone 4 — Schedule Engine Foundation

- Replaced student schedule strings with normalized recurring schedule records.
- Added schedule queries for today, this week, upcoming classes, and weekday grouping.
- Connected schedule data to student profiles, cards, dashboard stats, and the right panel.

### Milestone 3 — Attendance Engine Foundation

- Added typed attendance records and statuses.
- Added attendance summaries and reusable history timelines.
- Connected attendance history and computed attended totals to student profiles.

### Milestone 2 — Students Read-Only MVP

- Added responsive student cards with typed profile navigation.
- Added student profile pages, avatars, statuses, fee details, and motion interactions.
- Introduced the `FeeType` enum.

### Milestone 1 — Foundation

- Established the dark dashboard shell, navigation, shared UI primitives, and typed mock-data structure.
