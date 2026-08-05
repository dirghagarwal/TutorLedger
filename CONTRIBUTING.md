# Contributing to TutorLedger

## Development

1. Install dependencies with `npm install`.
2. Run the development server with `npm run dev`.
3. Run TypeScript validation with `node_modules/.bin/tsc.cmd --noEmit` on Windows or `npx tsc --noEmit` elsewhere.
4. Run lint with `npm run lint`.

## Guidelines

- Keep entities strongly typed; avoid `any` and duplicated domain fields.
- Put business rules in `lib/services` or `lib/utils`, not in components.
- Keep pages thin: compose data, services, and presentation components.
- Preserve one source of truth per entity.
- Use existing shadcn/ui primitives and the established dark TutorLedger visual language.
- Add mock data before adding persistence, and keep repository details out of UI code.
- Include empty, loading, error, keyboard, and responsive states for interactive features.
- Keep changes focused and update `CHANGELOG.md` after each reviewed milestone.

## Pull requests

Describe the user-facing result, list changed files, explain data-flow changes, and include TypeScript and ESLint results. Do not begin a later milestone in the same change unless it is required to keep the current milestone coherent.
