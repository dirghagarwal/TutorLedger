# Antigravity Programme Level 2 Audit: Architecture, Payments, AI Command Plane, iOS & Performance Review

**Repository:** `dirghagarwal/TutorLedger`  
**Target:** Main Branch (`0df3ef7`) & Open Pull Request #20 (`fix/payments-ios-ux`)  
**Reference Issue:** GitHub Issue #21 ("Programme Level 2: Antigravity audit — UI, payments, AI command plane, iOS, performance")  
**Reviewer:** Antigravity Audit & Review Agent  
**Date:** September 2026  
**Status:** Complete Audit (Read-Only; Zero Production Code or Database Changes)

---

## Executive Summary

This comprehensive Programme Level 2 review evaluates TutorLedger's architecture across mobile/iOS UX, tuition payment accounting, the conversational AI command plane, performance, multi-tenant security, and testing.

TutorLedger has established a solid architectural foundation with Programme Level 1, including salted `scrypt` teacher password hashing, tenant-scoped Prisma query extensions, parent portal signed JWT session tokens, and atomic deletion invariants. However, deep source inspection reveals critical architectural gaps across four major domains:

1. **Tuition Payment Accounting & Tenures:** The current `Payment` model and UI do not record the covered billing tenure (e.g., "September 2026" for monthly students, or covered date ranges/class counts for class-wise students). Instead, payments are treated as generic lump sums compared against global accrued totals. Furthermore, PR #20's payment edit mechanism introduces a dead end: it blocks editing payments with class allocations, but provides no UI or API to adjust or reallocate them.
2. **AI Command Plane & Tool Inventory:** The current AI command handler in `app/actions/ai.ts` covers only 12 semantic actions via unstructured JSON generation, missing over 60% of legitimate teacher operations (recurring schedule adjustments, permanent moves, one-off reschedules, student status updates, billing model edits, detailed session queries, and voice transcription).
3. **Universal iOS / Safari & Mobile Experience:** While PR #20 adds an iOS install guidance dialog, iOS Safari PWA support is incomplete: Apple Touch Icons are only provided as SVG (unsupported by iOS Home Screen shortcuts, causing blank/screenshot icons), `viewport-fit=cover` is omitted, input font sizes below 16px risk triggering automatic Safari viewport zoom, and attachments are encoded as large base64 strings directly inside database rows, causing severe memory spikes on mobile devices.
4. **Performance & Query Fan-Out:** Server-rendered routes (`/calendar`, `/students`, `/reports`) execute unconstrained `findMany` queries that retrieve entire database tables across all time without date or pagination boundaries. For instance, `/calendar` fetches all historical session notes and base64 attachments for the entire tenant, then filters them in memory.

Below is the concrete, file-level audit across all 24 required dimensions, followed by data model recommendations, tool architectures, and an implementation roadmap.

---

## 1. Concrete Findings Across the 24 Programme Dimensions

### Dimension 1: Universal iPhone / iPad / iOS / Safari UX
* **Severity:** **HIGH**
* **Affected Files:**
  * [`app/layout.tsx`](file:///c:/Users/dirgh/tutorledger/app/layout.tsx#L9-L16)
  * [`app/globals.css`](file:///c:/Users/dirgh/tutorledger/app/globals.css)
  * [`components/layout/Topbar.tsx`](file:///c:/Users/dirgh/tutorledger/components/layout/Topbar.tsx)
  * [`components/pwa/InstallPrompt.tsx`](file:///c:/Users/dirgh/tutorledger/components/pwa/InstallPrompt.tsx)
  * [`components/ui/dialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/ui/dialog.tsx), [`components/ui/sheet.tsx`](file:///c:/Users/dirgh/tutorledger/components/ui/sheet.tsx)
* **Current Implementation:**
  * `app/layout.tsx` defines static `metadata` without Next.js `viewport` configuration. There is no `viewportFit: "cover"` or `maximumScale: 1`.
  * Mobile elements use arbitrary padding (e.g. `bottom-5`) rather than `env(safe-area-inset-bottom)`.
  * Inputs in several dialogs use `text-xs` (12px) or `text-sm` (14px). In iOS Safari, any input with font-size `< 16px` forces the browser to automatically zoom into the field on focus, shifting the layout and requiring manual pinch-to-zoom out.
  * Sheet and modal dialogs lack `-webkit-overflow-scrolling: touch` and have rubber-banding issues when virtual keyboards pop up.
* **Recommended Implementation:**
  1. Add Next.js 15 viewport export in `app/layout.tsx`:
     ```ts
     import type { Viewport } from "next";
     export const viewport: Viewport = {
       width: "device-width",
       initialScale: 1,
       maximumScale: 5,
       viewportFit: "cover",
       themeColor: "#0b1020",
     };
     ```
  2. Implement utility classes in `globals.css` for safe areas:
     ```css
     .pb-safe { padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); }
     .pt-safe { padding-top: max(1rem, env(safe-area-inset-top)); }
     ```
  3. Ensure all text and select inputs on mobile have a base font size of `16px` (`text-base sm:text-sm`) to eliminate iOS focus zoom.
  4. Ensure all tap targets adhere to Apple HIG minimums (44×44 pt).

---

### Dimension 2: Android / Mobile UX
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`components/layout/MobileSidebar.tsx`](file:///c:/Users/dirgh/tutorledger/components/layout/MobileSidebar.tsx)
  * [`components/layout/SidebarContext.tsx`](file:///c:/Users/dirgh/tutorledger/components/layout/SidebarContext.tsx)
  * [`components/calendar/MobileMonthCalendar.tsx`](file:///c:/Users/dirgh/tutorledger/components/calendar/MobileMonthCalendar.tsx)
* **Current Implementation:**
  * Mobile sidebar uses a sheet modal with backdrop, but opening the virtual keyboard inside modals can cause visual clipping of bottom action buttons (`DialogFooter`).
  * Android hardware back button closes the entire web page rather than closing open sheets/modals due to lack of History API (`window.history.pushState`) synchronization on dialog state.
* **Recommended Implementation:**
  1. Push a dummy state or hash (`#modal`) when opening dialogs/sheets so the mobile back gesture dismisses the modal instead of navigating away.
  2. Use `dvh` (dynamic viewport height) units for full-screen sheets rather than `vh` to accommodate expanding/collapsing browser URL bars on Android Chrome.

---

### Dimension 3: PWA Installation
* **Severity:** **HIGH**
* **Affected Files:**
  * [`components/pwa/InstallPrompt.tsx`](file:///c:/Users/dirgh/tutorledger/components/pwa/InstallPrompt.tsx)
  * [`app/manifest.ts`](file:///c:/Users/dirgh/tutorledger/app/manifest.ts)
  * [`public/icons/`](file:///c:/Users/dirgh/tutorledger/public/icons)
  * [`public/sw.js`](file:///c:/Users/dirgh/tutorledger/public/sw.js)
* **Current Implementation:**
  * In `main`, `InstallPrompt.tsx` returns `null` unless the `beforeinstallprompt` event fires. iOS Safari *never* emits this event, leaving iPhone and iPad users without installation guidance.
  * In PR #20, an iOS help modal was introduced, but icons in `public/icons/` remain exclusively `.svg` (`icon-192.svg`, `icon-512.svg`). iOS Safari does not support SVG for `apple-touch-icon`. Adding the site to the iOS Home Screen results in an ugly screenshot thumbnail instead of an app icon.
  * `public/sw.js` caches `/` during the service worker install phase. However, `/` requires teacher authentication. If installed in an unauthenticated or redirected state, the service worker caches a 307 redirect or login page.
* **Recommended Implementation:**
  1. Generate high-resolution PNG icons (`apple-touch-icon-180x180.png`, `icon-192.png`, `icon-512.png`) and register them in `manifest.ts` and `app/layout.tsx`.
  2. Update `InstallPrompt.tsx` with proper user-agent and `display-mode: standalone` detection: hide prompt if already installed in standalone mode; show native prompt trigger on Chromium; show Safari Share Sheet walkthrough on iOS/iPadOS.
  3. Update `sw.js` to only cache static assets (`/_next/static/*`, `/icons/*`, `/manifest.webmanifest`), using network-first strategy with an offline fallback page for HTML navigation.

---

### Dimension 4: File / Image / PDF Upload UX
* **Severity:** **HIGH**
* **Affected Files:**
  * [`lib/repositories/attachments.ts`](file:///c:/Users/dirgh/tutorledger/lib/repositories/attachments.ts#L24-L27)
  * [`app/actions/sessions.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/sessions.ts#L99-L109)
  * [`lib/validations/session.ts`](file:///c:/Users/dirgh/tutorledger/lib/validations/session.ts#L28-L41)
  * [`components/sessions/SessionDetailsSheet.tsx`](file:///c:/Users/dirgh/tutorledger/components/sessions/SessionDetailsSheet.tsx#L245-L260)
* **Current Implementation:**
  * In `app/actions/sessions.ts:101`, uploaded files are converted to Base64 data URLs:
    `const storagePath = `data:${safeMime};base64,${base64}`;`
    and stored directly in PostgreSQL inside the `Attachment.storagePath` column.
  * Storing 5 MB images/PDFs as ~7 MB base64 text in database rows bloats PostgreSQL table storage, slows down every query selecting attachments, and can exceed memory limits during mobile page renders.
  * In `SessionDetailsSheet.tsx:256`, the file input specifies:
    `accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,*/*"`
    However, `validateAttachmentFile` in `lib/validations/session.ts` strictly rejects anything outside JPEG, PNG, WEBP, and PDF. Users selecting `.docx` receive a generic failure.
* **Recommended Implementation:**
  1. Align UI `accept` attributes strictly with validated MIME types: `accept="image/jpeg,image/png,image/webp,application/pdf"`.
  2. Transition attachment storage from in-database base64 strings to cloud object storage (e.g. Vercel Blob, Supabase Storage, or AWS S3 presigned URLs), storing only clean storage URLs in PostgreSQL.
  3. Include a thumbnail preview, upload progress indicator, and file size badge on mobile sheets before committing uploads.

---

### Dimension 5: Home AI Command Interface & Visual Artifacts
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`app/page.tsx`](file:///c:/Users/dirgh/tutorledger/app/page.tsx#L16-L56)
  * [`components/workspace/CommandBar.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/CommandBar.tsx#L182-L248)
  * [`components/workspace/TodayClasses.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/TodayClasses.tsx)
  * [`components/workspace/Stats.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/Stats.tsx)
* **Current Implementation:**
  * `app/page.tsx` renders a centered search box with heavy ambient blur graphics (`bg-blue-600/[0.045] blur-[120px]`), a "TL" avatar badge, and negative vertical translation (`-translate-y-8`).
  * On mobile devices, when the virtual keyboard appears, the negative translation and centered layout push the input out of view or cause awkward scrolling.
  * `TodayClasses.tsx` and `Stats.tsx` were completely unmounted from `app/page.tsx` in a recent commit. As a result, teachers opening TutorLedger cannot see today's agenda or quick-action class controls ("Start class", "Mark present") without navigating to other routes.
  * In `CommandBar.tsx`, the minimal view hides active session context, sample prompts, and recent command history, reducing discoverability.
* **Recommended Implementation:**
  1. Mount a compact, mobile-optimized "Today's Agenda" widget below the CommandBar on Home, restoring immediate access to `TodayClasses` without cluttering the screen.
  2. Remove excessive nested blur divs; use clean CSS borders with subtle ambient shadows.
  3. Move active session context badges and quick prompt chips into a compact horizontally scrollable carousel (`no-scrollbar`) directly beneath the command bar.

---

### Dimension 6: Payment Accounting & Payment-Tenure Model
* **Severity:** **CRITICAL**
* **Affected Files:**
  * [`prisma/schema.prisma`](file:///c:/Users/dirgh/tutorledger/prisma/schema.prisma#L165-L182)
  * [`lib/services/payments.ts`](file:///c:/Users/dirgh/tutorledger/lib/services/payments.ts#L81-L147)
  * [`lib/services/billing.ts`](file:///c:/Users/dirgh/tutorledger/lib/services/billing.ts#L53-L74)
  * [`components/workspace/PaymentDialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/PaymentDialog.tsx)
* **Current Implementation:**
  * The `Payment` database model stores:
    `id, studentId, sessionId, amount, date, method, status, billingPeriod, notes`.
  * `billingPeriod` is treated as a coarse enum string (`"MONTHLY"` or `"CLASSWISE"`). There is no field recording *which* month/tenure a payment covers (e.g. `2026-08`), nor which date range/class count was purchased.
  * In `lib/services/payments.ts`, monthly ledger balance is calculated by summing *all* historical payments ever collected for a student and subtracting total accrued fees from enrollment to current month.
  * This creates severe accounting opacity:
    * If a parent pays ₹4,000 in September for August, the payment date is recorded as September, and the system cannot tell the parent or teacher which months are settled vs unpaid.
    * If a student pauses tuition or pays in advance for future months, the current ledger lumps advance cash into current balance without attributing it to the intended billing tenure.
* **Recommended Implementation:**
  * **Additive Schema Evolution (Zero Destructive Migration):**
    Add optional fields to `Payment`:
    * `coveredMonth String?` (e.g., `"2026-08"` for monthly fees)
    * `coveredFromDate String?` (e.g., `"2026-09-01"` for class-wise packages)
    * `coveredToDate String?` (e.g., `"2026-09-20"` for class-wise packages)
    * `coveredClassCount Int?` (e.g., `6` classes)
  * This preserves backward compatibility for existing records while enabling precise tenure tracking and statements.

---

### Dimension 7: Class-Wise Date-Range / Class-Count / Session Allocation
* **Severity:** **HIGH**
* **Affected Files:**
  * [`lib/repositories/payments.ts`](file:///c:/Users/dirgh/tutorledger/lib/repositories/payments.ts#L89-L137)
  * [`components/workspace/PaymentDialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/PaymentDialog.tsx)
  * [`app/actions/workflow.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/workflow.ts)
* **Current Implementation:**
  * When `billingPeriod === BillingPeriod.CLASSWISE`, `createPaymentWithAllocations` runs an automated FIFO allocation in code: it queries all unallocated `PRESENT` sessions and automatically creates `PaymentAllocation` records up to `input.amount`.
  * The manual `PaymentDialog` provides no inputs to define a date range (`from` -> `to`), select specific sessions, or specify how many classes are covered.
  * If a student attended classes in July and August, but the parent pays specifically for August classes, the system forcibly allocates cash to July first, violating the teacher's/parent's agreed allocation.
* **Recommended Implementation:**
  1. In `PaymentDialog`, when `CLASSWISE` is selected, present three allocation options:
     * **Auto (FIFO):** Allocate to oldest unpaid classes (current behavior).
     * **Date Range:** Specify start and end dates to allocate strictly within that window.
     * **Session Picker:** Interactive checklist of attended classes with individual fee amounts.
  2. Store `coveredFromDate`, `coveredToDate`, and `coveredClassCount` on `Payment`, and allocate `PaymentAllocation` records matching the teacher's selection.

---

### Dimension 8: Monthly Payment Month Selection
* **Severity:** **HIGH**
* **Affected Files:**
  * [`components/workspace/PaymentDialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/PaymentDialog.tsx#L50-L70)
  * [`lib/validations/workflow.ts`](file:///c:/Users/dirgh/tutorledger/lib/validations/workflow.ts#L7-L18)
* **Current Implementation:**
  * In `PaymentDialog.tsx`, when "Monthly" is selected, the dialog only displays a single "Payment date" field (`type="date"`). It defaults to today.
  * Teachers recording a fee received on the 2nd of September for "August Tuition" have no mechanism to indicate that August was paid.
* **Recommended Implementation:**
  1. In `PaymentDialog.tsx`, conditionally render a "Billing Month" picker when `billingPeriod === "MONTHLY"`.
  2. Default the billing month to the earliest unpaid month for that student (or current month if caught up).
  3. Validate `coveredMonth` matching `/^\d{4}-\d{2}$/` in `lib/validations/workflow.ts`.

---

### Dimension 9: Payment Editing (PR #20 Audit)
* **Severity:** **HIGH**
* **Affected Files:**
  * [`lib/repositories/payments.ts`](file:///c:/Users/dirgh/tutorledger/lib/repositories/payments.ts) (in PR #20)
  * [`app/actions/workflow.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/workflow.ts) (in PR #20)
  * [`components/payments/PaymentsClient.tsx`](file:///c:/Users/dirgh/tutorledger/components/payments/PaymentsClient.tsx) (in PR #20)
* **Current Implementation in PR #20:**
  * PR #20 adds `updatePaymentWithAllocations` in `lib/repositories/payments.ts`:
    ```ts
    const allocations = await tx.paymentAllocation.findMany({
      where: { paymentId: input.id, teacherId },
      select: { amount: true },
    });
    if (allocations.length > 0 && existing.amount !== input.amount) {
      throw new Error(
        "Amount cannot be changed while this payment has class allocations. Edit the allocations first."
      );
    }
    ```
  * **Flaws in PR #20:**
    1. **Dead-End UX:** There is no UI, dialog, or server action anywhere in TutorLedger to "edit the allocations first." If a teacher made a typo in the amount of a classwise payment, editing is permanently blocked.
    2. **Unreconciled Period Changes:** If a teacher changes `billingPeriod` from `CLASSWISE` to `MONTHLY`, the existing `PaymentAllocation` records remain orphaned in the database.
    3. **Missing Audit Logging:** `updatePayment` does not record an entry in `AuditLog`, unlike other sensitive financial and deletion operations.
* **Recommended Implementation:**
  1. If the payment amount changes, transactionally adjust or re-run the allocations within `tx`, rather than throwing an unrecoverable error. If reducing the amount below allocated sum, proportionally de-allocate newest allocations.
  2. If switching to `MONTHLY`, remove class allocations within the transaction.
  3. Emit an `AuditLog` entry documenting the previous vs updated values and teacher ID.

---

### Dimension 10: Complete AI Command / Action Coverage
* **Severity:** **CRITICAL**
* **Affected Files:**
  * [`lib/validations/ai.ts`](file:///c:/Users/dirgh/tutorledger/lib/validations/ai.ts#L6-L20)
  * [`app/actions/ai.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/ai.ts#L166-L750)
* **Current Implementation:**
  * `aiSemanticOutputSchema` recognizes only 12 actions.
  * Real teacher workflows require managing schedules, editing fees, rescheduling sessions, looking up session history, and navigating records. These operations currently fail or trigger the catch-all `QUERY_STATS`.
* **Action Coverage Audit Table:**

| Action Category | Target Teacher Capability | In Current AI Schema? | Implemented in `app/actions/ai.ts`? | Recommended Status |
| :--- | :--- | :--- | :--- | :--- |
| **Attendance** | Mark present/absent/cancelled | Yes (`RECORD_ATTENDANCE`) | Yes | Supported |
| **Attendance** | Multi-date attendance ("2nd & 9th Aug") | Partial | Yes (loops dates) | Supported |
| **Session Control** | Start live class | Yes (`START_CLASS`) | Yes | Supported |
| **Session Control** | End live class & record duration | Yes (`END_CLASS`) | Yes | Supported |
| **Session Notes** | Add topic, homework, classwork | Yes (`ADD_SESSION_NOTE`) | Yes | Supported |
| **Session Notes** | Query past homework / topics | No | No | **Needs Implementation** |
| **Scheduling** | Add recurring weekly class | No | No | **Needs Implementation** |
| **Scheduling** | Edit recurring schedule slot | No | No | **Needs Implementation** |
| **Scheduling** | Move class permanently | No | No | **Needs Implementation** |
| **Scheduling** | One-off session rescheduling | No | No | **Needs Implementation** |
| **Scheduling** | Delete single class vs recurring | Partial (`DELETE_SESSION`) | Yes | Supported |
| **Payments** | Record payment with tenure | Partial (no tenure) | Yes (generic) | **Needs Tenure Support** |
| **Payments** | Edit previous payment record | No | No | **Needs Implementation** |
| **Payments** | Class-wise range allocation | No | No | **Needs Implementation** |
| **Students** | Create new student | Yes (`CREATE_STUDENT`) | Yes | Supported |
| **Students** | Edit student fee / model / color | No | No | **Needs Implementation** |
| **Students** | Deactivate / archive student | No | No | **Needs Implementation** |
| **Students** | Delete student (with safety confirmation) | Yes (`DELETE_STUDENT_REQUEST`) | Yes (double confirmation) | Supported |
| **Navigation** | Open student profile / calendar | No | No | **Needs Implementation** |
| **Reports** | Query who owes fees / revenue | Yes (`QUERY_STATS`) | Yes | Supported |

---

### Dimension 11: Recurring Schedule Creation / Editing / Deletion
* **Severity:** **HIGH**
* **Affected Files:**
  * [`app/actions/schedule.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/schedule.ts)
  * [`components/students/ScheduleDialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/students/ScheduleDialog.tsx)
  * [`lib/repositories/schedules.ts`](file:///c:/Users/dirgh/tutorledger/lib/repositories/schedules.ts)
* **Current Implementation:**
  * `addScheduleAction`, `editScheduleAction`, and `removeScheduleAction` exist in `app/actions/schedule.ts`.
  * Collision detection checks `(studentId, dayOfWeek, startTime, active: true)`.
  * However, when a schedule is removed, `removeScheduleAction` soft-deactivates the schedule if any sessions reference it, which correctly avoids cascade deletion.
  * **Gap:** Schedule creation does not validate whether the newly created schedule conflicts with *another* student taught by the same teacher at the exact same day/time (teacher double-booking).
* **Recommended Implementation:**
  1. Add teacher-level time conflict warning: query `Schedule` across all students for that `teacherId` and warn if another learner is already booked for that slot.
  2. Surface schedule management tools in the AI command plane (`CREATE_SCHEDULE`, `REMOVE_SCHEDULE`).

---

### Dimension 12: Permanent Schedule Changes
* **Severity:** **HIGH**
* **Affected Files:**
  * [`app/actions/schedule.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/schedule.ts#L51-L89)
  * [`lib/services/session-data.ts`](file:///c:/Users/dirgh/tutorledger/lib/services/session-data.ts)
* **Current Implementation:**
  * When a teacher changes an existing recurring schedule (e.g. from Monday 4:00 PM to Monday 5:30 PM), `editScheduleAction` updates the `Schedule` table row.
  * **Critical Bug:** It does *not* reconcile future `Session` rows that were already generated in the database. Any future session created in advance retains the old `startTime` and `endTime`.
* **Recommended Implementation:**
  * Inside `editScheduleAction`, within a transaction, update all future unattended (`status: PLANNED`) sessions linked to that `scheduleId`:
    ```ts
    await tx.session.updateMany({
      where: {
        scheduleId: id,
        teacherId,
        date: { gte: getTodayDateKey() },
        status: SessionStatus.PLANNED,
      },
      data: {
        startTime: values.startTime,
        endTime: values.endTime,
      },
    });
    ```

---

### Dimension 13: One-Off Rescheduling
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`app/actions/sessions.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/sessions.ts#L308-L387)
  * [`components/sessions/EditSessionDialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/sessions/EditSessionDialog.tsx)
* **Current Implementation:**
  * One-off session edits are handled by `updateSessionAction`.
  * It validates that no session collision exists on `(studentId, newDate, newStartTime)`.
  * However, if the session is moved to a new date, `Attendance.date` is updated, but if payment allocations exist, the relationship between session and allocation is maintained.
  * Missing from AI commands: "Reschedule Tanay's Friday class to Saturday 11am" cannot be executed via chatbot.
* **Recommended Implementation:**
  1. Expose explicit `RESCHEDULE_SESSION` tool in AI command plane.
  2. In `EditSessionDialog`, make it clear to teachers whether they are modifying *only this specific session* vs *all future recurring classes*.

---

### Dimension 14: Class Start / Stop Timing & Duration
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`app/actions/workflow.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/workflow.ts#L49-L55)
  * [`app/actions/sessions.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/sessions.ts)
  * [`components/workspace/TodayClasses.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/TodayClasses.tsx)
* **Current Implementation:**
  * `updateClassStatus` handles setting `startedAt`, `endedAt`, and calculates `durationMinutes`.
  * However, if a teacher starts a class and forgets to end it until the next day, `durationMinutes` calculates as hundreds of minutes without sanity bounds.
* **Recommended Implementation:**
  1. Cap automatic duration calculation at scheduled slot duration + 60 minutes max, or prompt teacher: "Class ran for 18 hours? Confirm duration in minutes."

---

### Dimension 15: Present / Absent / Cancelled / Rescheduled Actions
* **Severity:** **HIGH**
* **Affected Files:**
  * [`app/actions/sessions.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/sessions.ts#L337-L381)
  * [`app/actions/parent-portal.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/parent-portal.ts#L225-L270)
* **Current Implementation:**
  * In `app/actions/parent-portal.ts` (`executeStudentCancellation`), there is an atomic check:
    ```ts
    const allocations = await tx.paymentAllocation.count({ where: { sessionId } });
    if (allocations > 0) throw new Error("CANNOT_CANCEL_ALLOCATED_SESSION");
    ```
  * **Discrepancy:** In the teacher's own `updateSessionAction` in `app/actions/sessions.ts`, this check is *missing*! If a teacher manually changes a session to `CANCELLED`, it succeeds even if the session has payment allocations attached.
* **Recommended Implementation:**
  * Add the same payment allocation invariant check to `updateSessionAction`: if a session has allocations, prevent status change to `CANCELLED` unless the teacher explicitly reallocates or refunds the fee.

---

### Dimension 16: Student Operations (Create / Edit / Deactivate / Archive)
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`app/actions/students.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/students.ts)
  * [`components/students/StudentFormDialog.tsx`](file:///c:/Users/dirgh/tutorledger/components/students/StudentFormDialog.tsx)
* **Current Implementation:**
  * `addStudent`, `editStudent`, and `deleteStudent` are fully implemented with strong confirmation for deletion.
  * In `StudentFormDialog.tsx`, an `active` checkbox is present.
  * **Gap:** When a student is marked inactive (`active: false`), their recurring schedules are *not* automatically deactivated. Future sessions continue to be populated on the calendar for archived students.
* **Recommended Implementation:**
  * In `editStudent`, if `active` transitions from `true` to `false`, automatically soft-deactivate all associated active schedules (`Schedule.active = false`).

---

### Dimension 17: Notes / Homework / Classwork
* **Severity:** **LOW**
* **Affected Files:**
  * [`lib/repositories/session-notes.ts`](file:///c:/Users/dirgh/tutorledger/lib/repositories/session-notes.ts)
  * [`app/actions/sessions.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/sessions.ts#L37-L67)
  * [`components/sessions/RecordClassForm.tsx`](file:///c:/Users/dirgh/tutorledger/components/sessions/RecordClassForm.tsx)
* **Current Implementation:**
  * Structured notes with `topic`, `classwork`, `homework`, and `remarks` are supported in DB and forms.
  * Deleting a session cascades cleanly to session notes within transactions.
* **Recommended Implementation:**
  * Add search indexing or text query capability so teachers can ask the AI: "What homework was given to Aahan on Tuesday?"

---

### Dimension 18: Reports / Statistics / Search
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`app/reports/page.tsx`](file:///c:/Users/dirgh/tutorledger/app/reports/page.tsx#L32-L52)
  * [`components/reports/ReportsClient.tsx`](file:///c:/Users/dirgh/tutorledger/components/reports/ReportsClient.tsx)
* **Current Implementation:**
  * In `app/reports/page.tsx`, per-student summary calculation runs:
    ```ts
    const studentAttendance = attendanceRecords.filter((a) => {
      const sess = sessions.find((s) => s.id === a.sessionId);
      return sess ? sess.studentId === student.id : false;
    });
    ```
    This is an $O(N \times A \times S)$ nested iteration executed in memory on every request.
  * `ReportsClient.tsx` lacks search inputs, date-range filters, and export buttons (CSV/PDF).
* **Recommended Implementation:**
  1. Build a `Map<string, string>` from `sessionId` to `studentId` before iteration to reduce complexity to $O(A)$.
  2. Add real-time text search and active/archived filters in `ReportsClient.tsx`.
  3. Provide a client-side CSV export of student financial summaries.

---

### Dimension 19: AI Written + Voice Commands
* **Severity:** **HIGH**
* **Affected Files:**
  * [`components/workspace/CommandBar.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/CommandBar.tsx)
  * [`app/actions/ai.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/ai.ts)
* **Current Implementation:**
  * `CommandBar.tsx` only accepts keyboard text.
  * There is no microphone button, no integration with Web Speech API (`webkitSpeechRecognition`), and no audio recording handler.
  * Tutors conducting classes on mobile devices find voice input significantly faster than typing complex class details.
* **Recommended Implementation:**
  1. Add a microphone icon button to `CommandBar.tsx`.
  2. Implement client-side `webkitSpeechRecognition` with auto-stop on silence for instant text population.
  3. Provide visual audio waveform/recording indicators.
  4. Ensure graceful fallback if microphone permission is denied or unsupported in browser.

---

### Dimension 20: Conversational Follow-ups & Active Context
* **Severity:** **HIGH**
* **Affected Files:**
  * [`app/actions/ai.ts`](file:///c:/Users/dirgh/tutorledger/app/actions/ai.ts#L65-L74)
  * [`components/workspace/CommandBar.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/CommandBar.tsx#L45-L74)
* **Current Implementation:**
  * `CommandBar.tsx` maintains client-side `history: ConversationMessage[]` and `activeContext: ActiveSessionContext`.
  * In `app/actions/ai.ts`, conversational context is passed to Gemini, but the deterministic fallback parser `parsePromptFallback` only inspects the single previous message to look for student names.
  * Follow-up corrections such as "Actually for August" or "Make that 3000" fail in the fallback parser.
* **Recommended Implementation:**
  1. In `app/actions/ai.ts`, ensure `activeContext` carries `lastIntent`, `lastAmount`, `lastStudentId`, and `lastDate`.
  2. Treat corrections as atomic context merges: if `activeContext` has student Aahan and user says "₹3500 instead", apply the update to the pending action.

---

### Dimension 21: Tenant Isolation & Security
* **Severity:** **HIGH**
* **Affected Files:**
  * [`lib/db/tenant-prisma.ts`](file:///c:/Users/dirgh/tutorledger/lib/db/tenant-prisma.ts#L29-L51)
  * [`prisma/schema.prisma`](file:///c:/Users/dirgh/tutorledger/prisma/schema.prisma)
  * [`lib/auth/session.ts`](file:///c:/Users/dirgh/tutorledger/lib/auth/session.ts)
* **Current Implementation:**
  * Tenant isolation is enforced via Prisma client extensions in `tenant-prisma.ts`.
  * In line 37, it injects `teacherId` into `args.where` for `findUnique`.
  * **Subtle Schema Risk:** In Prisma, calling `findUnique({ where: { id, teacherId } })` requires a compound unique index `@@unique([id, teacherId])` on the model. Without it, Prisma's strict client validation can reject non-unique fields in `findUnique`.
  * Currently, models (`Student`, `Session`, `Payment`) have single-column `@id` on `id`, and non-unique index `@@index([teacherId])`.
* **Recommended Implementation:**
  * In `tenant-prisma.ts`, intercept `findUnique` operations and route them via `findFirst({ where: { id, teacherId } })` to ensure 100% tenant isolation without triggering Prisma unique-constraint validation errors.

---

### Dimension 22: Next.js & Vercel Performance
* **Severity:** **HIGH**
* **Affected Files:**
  * [`app/calendar/page.tsx`](file:///c:/Users/dirgh/tutorledger/app/calendar/page.tsx#L36-L43)
  * [`app/students/page.tsx`](file:///c:/Users/dirgh/tutorledger/app/students/page.tsx#L21-L29)
  * [`app/reports/page.tsx`](file:///c:/Users/dirgh/tutorledger/app/reports/page.tsx#L21-L26)
* **Current Implementation:**
  * All main dashboard routes enforce `export const dynamic = "force-dynamic"`.
  * Server components execute parallel `findStudents()`, `findAttendance()`, `findPayments()`, `findSessions()`, `findSessionNotes()`, `findAttachments()`.
  * Every page visit downloads the entire historical dataset into the Vercel serverless function memory, causing severe latency and compute overhead as data grows.
* **Recommended Implementation:**
  1. Add date-bounded parameters to repository functions: `findSessionsForDateRange(startDate, endDate)`.
  2. In `app/calendar/page.tsx`, fetch notes and attachments *only* for session IDs present in the active calendar month.
  3. Exclude heavy attachment `storagePath` Base64 payloads from list/calendar queries, fetching full content only when an individual session sheet is opened.

---

### Dimension 23: Unnecessary Refreshes, Query Fan-Out & Navigation
* **Severity:** **MEDIUM**
* **Affected Files:**
  * [`app/students/page.tsx`](file:///c:/Users/dirgh/tutorledger/app/students/page.tsx#L29)
  * [`components/workspace/CommandBar.tsx`](file:///c:/Users/dirgh/tutorledger/components/workspace/CommandBar.tsx#L90)
* **Current Implementation:**
  * In `app/students/page.tsx:29`:
    `const pendingFeesTotal = await getTotalOutstandingBalance(students, payments);`
    Because `sessions` and `attendanceRecords` were not forwarded as arguments, `getTotalOutstandingBalance` internally queries the database a second time for sessions and attendance.
  * In `CommandBar.tsx:90`, every successful AI mutation calls `router.refresh()`, triggering a full server component tree re-fetch and re-render of the entire page.
* **Recommended Implementation:**
  1. Pass already resolved `sessions` and `attendanceRecords` into `getTotalOutstandingBalance`.
  2. Implement optimistic UI state updates for immediate user feedback before calling `router.refresh()`.

---

### Dimension 24: Production Test Coverage
* **Severity:** **HIGH**
* **Affected Files:**
  * [`tests/`](file:///c:/Users/dirgh/tutorledger/tests) (42 passing tests)
* **Current Implementation:**
  * 42 unit tests cover attachment magic bytes, billing calculations, Indian date parsing, schedule integrity, portal token signatures, and mock tenant isolation.
  * **Test Gaps:**
    * Zero tests for `app/actions/workflow.ts` (`recordPayment`, `updatePayment`, `recordAttendance`).
    * Zero tests for `app/actions/ai.ts` prompt parsing, multi-date commands, or fallback parsing.
    * Zero tests for `app/actions/schedule.ts` permanent schedule propagation.
    * Zero integration tests verifying Prisma extension query isolation with multiple real teachers.
* **Recommended Implementation:**
  * Add dedicated test suites in `tests/`:
    * `tests/ai-command-plane.test.ts`
    * `tests/payment-accounting.test.ts`
    * `tests/workflow-actions.test.ts`

---

## 2. Deep-Dive Architectures & Recommendations

### 2.1 Payment Accounting & Tenure Data Model
To satisfy actual tuition accounting without breaking existing database records, we recommend an **additive schema extension**:

```prisma
model Payment {
  id                String              @id
  teacherId         String
  studentId         String
  sessionId         String?
  amount            Int
  date              String              // Transaction date (e.g. "2026-09-02")
  method            String              // UPI, CASH, BANK_TRANSFER
  status            String              // PAID, PARTIAL, PENDING
  billingPeriod     String              // "MONTHLY" | "CLASSWISE"
  coveredMonth      String?             // "YYYY-MM" (e.g. "2026-08") for Monthly
  coveredFromDate   String?             // "YYYY-MM-DD" for Class-wise range
  coveredToDate     String?             // "YYYY-MM-DD" for Class-wise range
  coveredClassCount Int?                // Number of classes purchased
  notes             String
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  student           Student             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  session           Session?            @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  allocations       PaymentAllocation[]

  @@index([teacherId, studentId, date])
  @@index([teacherId, coveredMonth])
}
```

#### Invariant Enforcement Matrix
1. **Monthly Payments:**
   * If `billingPeriod == MONTHLY`, `coveredMonth` must match `/^\d{4}-(0[1-9]|1[0-2])$/`.
   * Multiple partial payments for the same `coveredMonth` are allowed until `sum(amount) >= student.fee`.
2. **Class-Wise Payments:**
   * If `billingPeriod == CLASSWISE`, `coveredClassCount` must equal `amount / student.fee`.
   * Allocations link to specific attended session IDs within `[coveredFromDate, coveredToDate]`.
3. **Editing Payments:**
   * If amount is edited, atomic transaction adjusts allocations or redistributes to matching session criteria without throwing unrecoverable errors.

---

### 2.2 AI Command Plane: Typed Tool Inventory & Architecture
Rather than asking the LLM to emit unstructured JSON, TutorLedger should adopt standard Gemini Tool Declarations (`tools: [{ functionDeclarations: [...] }]`):

```typescript
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const TUTOR_LEDGER_AI_TOOLS: AiToolDefinition[] = [
  // 1. Attendance & Class Lifecycle
  {
    name: "record_attendance",
    description: "Mark attendance (present, absent, cancelled) for a student across one or multiple dates.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentName: { type: "STRING", description: "Learner name" },
        dates: { type: "ARRAY", items: { type: "STRING" }, description: "Dates in YYYY-MM-DD" },
        status: { type: "STRING", enum: ["PRESENT", "ABSENT", "CANCELLED"] },
      },
      required: ["studentName", "dates", "status"],
    },
  },
  {
    name: "start_live_class",
    description: "Start timing a tuition session right now.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentName: { type: "STRING" },
      },
      required: ["studentName"],
    },
  },
  {
    name: "end_live_class",
    description: "Complete and stop timing the current in-progress session.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentName: { type: "STRING" },
        durationMinutes: { type: "NUMBER" },
      },
      required: ["studentName"],
    },
  },
  // 2. Schedule Operations
  {
    name: "create_recurring_schedule",
    description: "Set up a recurring weekly class slot for a student.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentName: { type: "STRING" },
        dayOfWeek: { type: "STRING", enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] },
        startTime: { type: "STRING", description: "HH:MM (24-hr)" },
        endTime: { type: "STRING", description: "HH:MM (24-hr)" },
      },
      required: ["studentName", "dayOfWeek", "startTime", "endTime"],
    },
  },
  {
    name: "reschedule_single_session",
    description: "Move a specific class to a different date or time without changing the recurring schedule.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentName: { type: "STRING" },
        originalDate: { type: "STRING", description: "YYYY-MM-DD" },
        newDate: { type: "STRING", description: "YYYY-MM-DD" },
        newStartTime: { type: "STRING" },
        newEndTime: { type: "STRING" },
      },
      required: ["studentName", "originalDate", "newDate"],
    },
  },
  // 3. Tuition Payments & Accounting
  {
    name: "record_tuition_payment",
    description: "Record a received tuition fee with explicit month or class-wise range coverage.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentName: { type: "STRING" },
        amount: { type: "NUMBER" },
        paymentDate: { type: "STRING", description: "YYYY-MM-DD" },
        paymentMethod: { type: "STRING", enum: ["UPI", "CASH", "BANK_TRANSFER"] },
        coveredMonth: { type: "STRING", description: "YYYY-MM (for monthly learners)" },
        classCount: { type: "NUMBER", description: "Number of classes covered (class-wise)" },
      },
      required: ["studentName", "amount"],
    },
  },
  // 4. Queries & Navigation
  {
    name: "query_financials",
    description: "Lookup fee balances, pending fees, revenue, or payment history.",
    parameters: {
      type: "OBJECT",
      properties: {
        queryType: { type: "STRING", enum: ["PENDING_FEES", "MONTHLY_REVENUE", "STUDENT_BALANCE"] },
        studentName: { type: "STRING" },
      },
      required: ["queryType"],
    },
  },
  {
    name: "navigate_to_page",
    description: "Open a relevant record, profile, or view in the application.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: { type: "STRING", enum: ["STUDENT_PROFILE", "CALENDAR", "PAYMENTS", "REPORTS"] },
        studentName: { type: "STRING" },
      },
      required: ["destination"],
    },
  },
];
```

---

## 3. Evaluation of Open Pull Request #20 (`fix/payments-ios-ux`)

PR #20 addresses two items:
1. **iOS PWA Install Guidance:** Adds `Share -> Add to Home Screen` dialog in `InstallPrompt.tsx`.
   * **Audit Verdict:** The guidance dialog text is helpful, but fails to provide PNG Apple Touch Icons, leaving the Home Screen icon broken on iPhones.
2. **Payment Editing:** Adds `updatePaymentWithAllocations` and edit buttons in `PaymentsClient.tsx`.
   * **Audit Verdict:** Introduces a UX trap by blocking amount edits if allocations exist, without offering an allocation editor.

**Recommendation:** Do not merge PR #20 as-is. Cherry-pick the iOS dialog into a comprehensive mobile branch that includes PNG touch icons and safe area insets, and upgrade the payment edit action to auto-reconcile allocations rather than blocking the teacher.

---

## 4. Implementation Order & Action Plan

1. **Phase 1: Security & Accounting Safeguards (Zero Migration)**
   * Add payment allocation checks to `updateSessionAction` to prevent cancelling allocated classes.
   * Fix `tenant-prisma.ts` `findUnique` routing to prevent Prisma validation runtime exceptions.
   * Reconcile schedule updates with future planned sessions.

2. **Phase 2: Payment Data Model & Dialog Overhaul**
   * Add optional `coveredMonth`, `coveredFromDate`, `coveredToDate`, and `coveredClassCount` to `Payment`.
   * Upgrade `PaymentDialog.tsx` with month pickers for monthly students and date-range/count controls for class-wise learners.
   * Provide seamless allocation reconciliation on payment edits.

3. **Phase 3: iOS / PWA & Mobile UX Polish**
   * Generate 180x180 PNG Apple Touch Icons.
   * Configure Next.js `viewport` with `viewportFit: "cover"`.
   * Enforce `16px` font size on all mobile form inputs to eradicate iOS focus zoom.
   * Apply `pb-safe` to floating buttons and dialog footers.

4. **Phase 4: AI Command Plane Expansion**
   * Implement typed tool declarations with Gemini API.
   * Expand action coverage to 25+ teacher actions including schedules, reschedules, and navigation.
   * Add client-side voice transcription via Web Speech API in `CommandBar.tsx`.

5. **Phase 5: Performance & Query Optimization**
   * Add date-bounded queries to `/calendar` and `/reports`.
   * Omit base64 attachment bodies from list/calendar queries.
   * Fix redundant query calls in `StudentsPage`.

---

*Report prepared and validated against the TutorLedger codebase on branch `audit/programme-level-2-review`.*
