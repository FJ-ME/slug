# Stable snapshot

Commit: 64718026fabf9fcd723a497ea5c7651225b9f8ab
Date: 2026-08-09

Summary:
- This snapshot represents a stable deployment point after resolving pnpm lockfile outdated error.
- Core functionality validated: short link creation (POST /api/shorten), short link redirect (GET /:slug), runtime monitoring with fallback transaction path, and successful Codespaces/CI build verification.

Changes since previous stable snapshot (23e64956):
- Fixed `ERR_PNPM_OUTDATED_LOCKFILE` by updating `pnpm-lock.yaml` for Prisma 5.13.0.
- Build verified locally (Codespaces) and reproducible with environment placeholders.

Why this is tagged as stable:
- Build succeeded for commit 64718026 (verified in Codespaces environment).
- Confirmed build routes: `/`, `/_not-found`, `/[slug]`, `/api/auth/[...nextauth]`, `/api/shorten`, `/auth`, `/auth/error`, `/check/[slug]`, `/dashboard`, `/dashboard/settings`, `/redirect/[slug]`.
- No build-time or pnpm-related failures.

Recommended usage:
- Pin deployments to this commit if you require a rollback target.

How to create a local annotated tag and push it (run in repo root):

```bash
git tag -a vstable-2026-08-09 64718026fabf9fcd723a497ea5c7651225b9f8ab -m "stable snapshot after pnpm-lock.yaml update for prisma 5.13.0"
git push origin vstable-2026-08-09
```

Rollback to this snapshot (if needed):

```bash
git checkout -b rollback-to-stable-64718026 64718026fabf9fcd723a497ea5c7651225b9f8ab
git push origin rollback-to-stable-64718026
```

Verification checklist (suggested):
- Confirm environment variables are set in Vercel: NEXT_PUBLIC_APP_URL, AUTH_SECRET, GITHUB_ID, GITHUB_CLIENT_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
- Run `pnpm install && pnpm prisma generate && pnpm run build` locally
- Smoke test POST /api/shorten and GET /:slug

Notes:
- This file is informational and does not create a Git tag automatically. Use the git tag commands above to create an annotated tag in the repository.
