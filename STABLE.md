# Stable snapshot

Commit: 23e64956c3aa5c54ea9015bd2ab71a6c409be896
Date: 2026-08-09

Summary:
- This snapshot represents a stable deployment point after fixing TypeScript/ESLint issues, adding the GET /:slug redirect route with clicks counting and a fallback transaction path, making SLUG length configurable via env, and adding lightweight monitoring for fallback usage in the GET handler.
- Core functionality validated: short link creation (POST /api/shorten), short link redirect (GET /:slug), DB compatibility fallback, and basic lint/type fixes to allow successful build.

Changes since previous stable snapshot (57d121e6):
- Added lightweight runtime monitoring: when the GET /:slug handler cannot perform an atomic increment, the code now logs a warning and falls back to a transaction-based update. This log helps track how often the fallback path is used in production and diagnose adapter compatibility issues.

Why this is tagged as stable:
- Build and deploy succeeded for commit 23e64956 (verified by the user).
- Includes necessary fixes to prevent build-time and runtime failures in typical environments.

Recommended usage
- Pin deployments to this commit if you require a rollback target.

How to create a local annotated tag and push it (run in repo root):

```bash
# create annotated tag locally
git tag -a vstable-2026-08-09 23e64956c3aa5c54ea9015bd2ab71a6c409be896 -m "stable snapshot after monitoring addition"
# push tag to origin
git push origin vstable-2026-08-09
```

Rollback to this snapshot (if needed):

```bash
# create branch from stable commit and force deploy if necessary
git checkout -b rollback-to-stable-23e64956 23e64956c3aa5c54ea9015bd2ab71a6c409be896
# push branch and open PR or push to main depending on workflow
git push origin rollback-to-stable-23e64956
```

Verification checklist (suggested):
- Confirm environment variables are set in Vercel: NEXT_PUBLIC_APP_URL, CF_SIGNATURE, API_KEY_SHORTEN, AUTH_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, CREATOR_ID, SLUG_LENGTH
- Run `pnpm install && pnpm prisma generate && pnpm run build` locally
- Smoke test POST /api/shorten and GET /:slug

Notes:
- This file is informational and does not create a Git tag automatically. Use the git tag commands above to create an annotated tag in the repository.
