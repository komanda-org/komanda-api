# Agents Guide (Internal)

Brief, practical checklist for working in this repo. For full context, see [README.md](README.md).

## Quick Start

- Install deps: `npm install`
- Create env file: `cp .env.example .env`
- Start DB: `npm run db:up`
- Run migrations: `npm run db:migrate`
- Start API: `npm run start:dev`

## Daily Workflow

- Pull latest changes before starting a task.
- Keep changes small and focused; avoid mixing refactors with features.
- Prefer NestJS modules and use-cases to keep boundaries clear.
- Do a quick self code review before saying the task is done.
- Update tests when behavior changes.

## Database and Prisma

- When editing [prisma/schema.prisma](prisma/schema.prisma), run `npm run db:migrate` with a descriptive name.
- Regenerate client if needed: `npm run db:generate`.
- Use `npm run db:reset` only for local dev data resets.

## Quality and Style

- Lint/format before PRs: `npm run lint`, `npm run format`.
- Follow existing patterns in `src/` for controllers, modules, DTOs, and use-cases.

## Testing

- Unit tests: `npm run test`
- Coverage: `npm run test:cov`
- E2E: `npm run test:e2e`

## PR Checklist

- Tests updated and passing.
- Lint and format clean.
- Migration added for schema changes.
- Clear PR description and scope.