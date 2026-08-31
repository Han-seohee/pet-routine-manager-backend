# Refactoring Backlog

> **Status:** Deferred — do not apply until a natural trigger occurs  
> (e.g. touching the same area for a new feature, or refactoring becomes unavoidable).

## Policy

1. **No proactive refactoring** — feature work takes priority.
2. **Revisit on trigger** — when implementing a new feature requires changing the same structure, or refactoring becomes the cheaper path, review the relevant items below.
3. **Mandatory fixes** — if a change is required that does not alter behavior (e.g. security patch, broken build), explain first:
   - Why it is needed
   - Which files will change
   - Impact on existing behavior  
   Then wait for confirmation before proceeding.

---

## Priority: High

Changes that reduce bug risk or centralize logic touched by most family features.

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 1 | **FamilyService membership / OWNER authorization duplication** | `src/family/family.service.ts` | `findFamilyById`, `findFamilyMembers`, `assertFamilyOwner` share the same membership lookup → family existence check → 404/403 pattern. Extract `assertFamilyMember()` / refine `assertFamilyOwner()`. |
| 2 | **Family response mapping duplication** | `src/family/family.service.ts` | `{ id, name, createdAt, updatedAt }` mapping repeated in `findMyFamilies`, `findFamilyById`, `updateFamily`. Extract e.g. `toFamilyDetail()`. |
| 3 | **Family name validation duplication** | `src/family/family.service.ts` | `createFamily` and `updateFamily` both trim + `BadRequestException`. Extract helper or move to DTO validation (see #4). |
| 4 | **DTO + class-validator + ValidationPipe** | `src/**/dto/*.ts`, `src/main.ts`, `package.json` | DTOs are plain `type`s; no global `ValidationPipe`. Convert to classes with decorators; register pipe in `main.ts`. Also covers oauth/family body validation. |

---

## Priority: Medium

NestJS ergonomics and API consistency; apply when adding controllers/endpoints.

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 5 | **FamilyController JwtAuthGuard duplication** | `src/family/family.controller.ts` | `@UseGuards(JwtAuthGuard)` on every handler → move to controller class level. |
| 6 | **`@CurrentUser()` decorator** | new `src/common/decorators/`, controllers | Replace `@Req() req` + `req.user.userId` boilerplate. |
| 7 | **`JwtAuthenticatedRequest` shared type** | `src/auth/auth.controller.ts`, `src/family/family.controller.ts` | Duplicate type definitions → e.g. `src/common/types/authenticated-request.type.ts`. |
| 8 | **`:id` UUID validation** | `src/family/family.controller.ts` | Add `ParseUUIDPipe` on `:id` params to fail fast before Prisma. |
| 9 | **OAuth callback response duplication** | `src/auth/auth.controller.ts` | `googleAuthCallback` / `kakaoAuthCallback` are identical → shared private handler. |

---

## Priority: Low

Config hygiene and test maintainability; apply when deploying or expanding test suite.

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 10 | **Environment variable externalization** | `src/main.ts`, `src/auth/google.strategy.ts`, `src/auth/kakao.strategy.ts`, `.env.example` | Hardcoded CORS origin (`localhost:3000`), OAuth callback URLs, JWT `expiresIn` (`1d`). Add e.g. `FRONTEND_URL`, `APP_BASE_URL`. |
| 11 | **Test mock / helper duplication** | `test/app.e2e-spec.ts`, `src/**/*.spec.ts` | Large inline PrismaService mock in e2e; repeated `jest.mock('../prisma/prisma.service')` in unit specs → extract shared helpers/factories. |

---

## Additional candidates (not in original list)

Lower urgency; revisit only if related work is in progress.

- **Auth profile upsert on re-login** — `findOrCreateUser` returns stale profile for existing users (`src/auth/auth.service.ts`).
- **JWT user existence check** — `JwtStrategy` does not verify user still exists in DB (`src/auth/jwt.strategy.ts`).
- **API response shape inconsistency** — `POST /families` returns full Prisma entities; GET/PATCH return trimmed DTOs.
- **Prisma schema stale TODO** — partial unique index already migrated; comment in `prisma/schema.prisma` should be updated.
- **Prisma P2002 → HTTP error mapping** — unique constraint violations surface as 500.
- **FamilyModule imports full AuthModule** — only JWT guard needed; consider slimmer module boundary.

---

## Natural trigger examples

| Trigger | Likely items to pull in |
|---------|-------------------------|
| New family endpoint (invite, leave, etc.) | #1, #2, #3, #5, #6, #7, #8 |
| New validated request DTOs | #4 |
| New OAuth provider | #9, #10 |
| Production deployment / staging env | #10 |
| New e2e or large spec additions | #11 |
| Auth flow changes (token refresh, profile sync) | #9, auth upsert, JWT validation |

---

*Last updated: 2026-08-31*
