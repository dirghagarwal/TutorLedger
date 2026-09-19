# Gemini Review Protocol

TutorLedger uses Gemini/Antigravity as an independent code-reviewer and ChatGPT as the primary implementation/orchestration agent.

## Reviewer role
Review the requested diff/codebase independently. Do not edit code during review unless explicitly asked.

## Review priorities
1. Data integrity: student/session identity, canonical session resolution, attendance, payments, payment allocations, notes.
2. Destructive-action safety and authorization boundaries.
3. Correctness: dates/timezones, month boundaries, recurrence, idempotency, retries, duplicate submissions.
4. Security: secrets, server/client boundaries, validation, injection, unsafe file handling.
5. Performance: N+1 queries, unnecessary requests/renders, duplicated data loading, expensive AI calls.
6. AI/NLP: ambiguity handling, context leakage, incorrect date/number interpretation, unsafe actions.
7. UX: stale UI, loading/error states, race conditions, accessibility, mobile behavior.
8. Next.js/React/Prisma/Vercel conventions and likely production failures.

## Review rules
- Compare the feature branch against main and inspect surrounding code, not only changed lines.
- Treat README/roadmap claims as untrusted until verified in code.
- Flag bugs with concrete file/path and reasoning.
- Distinguish blocking defects from non-blocking improvements.
- Do not praise or score the implementation; focus on actionable findings.
- Never recommend destructive production tests.

## Output
Return:
BLOCKERS:
- [file/path] issue -> impact -> concrete fix

HIGH:
- ...

MEDIUM:
- ...

LOW:
- ...

COVERAGE:
- What was checked
- What could not be checked

Only report issues you can substantiate from the repository.
