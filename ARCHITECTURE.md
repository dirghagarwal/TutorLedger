# TutorLedger Architecture

TutorLedger uses Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, SQLite, and Prisma. The UI depends on domain services, while repositories isolate Prisma from the rest of the application.

## Domain entities

- **Student**: identity and stable profile attributes such as name, subject, fee model, and active state.
- **Schedule**: the recurring timetable. It owns weekday, time range, subject, and active state.
- **Session**: a generated occurrence of a schedule on a specific date. It owns lifecycle status: planned, completed, cancelled, or rescheduled.
- **Attendance**: what happened for a session. Attendance references `sessionId`, not a duplicated student/date tuple.
- **Payment**: money movement or an outstanding payment record. It owns amount, method, status, billing period, and date.

Derived values are not stored on entities. Services calculate attendance totals, session lists, outstanding balances, revenue, and dashboard KPIs.

## Data flow

```text
SQLite via Prisma repositories
        |
        v
lib/services/*  ->  computed domain views  ->  pages/components
```

Pages compose services and pass typed values to presentation components. Components render props and do not calculate balances, class counts, or schedule/session business rules.

## Service boundaries

- `lib/services/attendance.ts`: attendance history and summaries.
- `lib/services/schedule.ts`: recurring schedule queries and upcoming recurring classes.
- `lib/services/sessions.ts`: session generation and date-based session queries.
- `lib/services/payments.ts`: payment history, balances, revenue, and pending students.

## Persistence and seeding

`lib/data` remains the seed source for reproducible local development. Runtime services read through `lib/repositories`, which map Prisma records into the existing domain types. `prisma/seed.ts` clears and repopulates the local database with the current mock records. Calendar UI consumes session and schedule service results, never recreating recurrence logic in the page.
