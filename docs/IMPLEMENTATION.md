# Sidequest implementation plan

The initial repository contains only a license. Build a full Next.js application with a PostgreSQL/Drizzle data layer, server-owned identity, and a standalone worker. Keep the core independent of external services.

1. Establish tokens, cast and motion contract; scaffold authentication, schema and deployment.
2. Build a representative slice: shell, Today, calendar segment, habit row, articulated Pip rig. Inspect the running slice before scaling.
3. Implement recurrence, immutable occurrence snapshots, sessions and atomic completion/XP.
4. Extend Week, Habits and Tasks; implement deterministic proposals and explicit recovery.
5. Add progress, preferences, reminders, portable data and optional validated AI drafts.
6. Exercise edge cases and end-to-end flows, review desktop/mobile/theme/motion, document actual verification and limitations.

## Visual QA checklist

- Clear next action; density comes from alignment, not tiny type.
- Calendar times, overlap lanes, fixed commitments and flexible sessions distinguishable without colour.
- Mobile has day navigation and agenda; no compressed week grid.
- Focus, labels, touch targets, keyboard scheduling and dialogs work.
- Light and dark semantic text contrasts; empty, error and loading states.
- Rig enters, anticipates, hops, lands, celebrates and recovers without blocking input.
- Reduced motion and hidden companions preserve every meaning; offscreen scenes pause.
- Real persistence, isolation and retries verified before claims.
