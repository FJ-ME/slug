#!/usr/bin/env bash
set -euo pipefail

# Release helper script - improved
# - Avoid passing invalid flags to prisma
# - Make build verification non-fatal (reports status but doesn't abort tag push)
# - Better error messages

# Config - adjust if needed
REPO_REMOTE=${REPO_REMOTE:-origin}
MAIN_BRANCH=${MAIN_BRANCH:-main}
STABLE_COMMIT="59c4749b12a52ad6d1e66d0aa2afe68d1d53d1d1"
TAG_NAME=${TAG_NAME:-vstable-2026-08-09}
TAG_MSG="stable snapshot after monitoring addition (commit 59c4749)"
ROLLBACK_BRANCH=${ROLLBACK_BRANCH:-rollback-to-stable-59c4749}

# Optional smoke test settings (set these env vars to run smoke tests)
# DEPLOY_URL="https://your-domain.example" (no trailing slash)
# API_KEY_SHORTEN="xxxx"
# TEST_SLUG optionally a known slug to test GET; if not provided, will attempt to create one via POST
DEPLOY_URL=${DEPLOY_URL:-}
API_KEY_SHORTEN=${API_KEY_SHORTEN:-}
TEST_SLUG=${TEST_SLUG:-}

echo "=== Release helper starting ==="
echo "Remote: $REPO_REMOTE, Main: $MAIN_BRANCH"
echo "Target commit: $STABLE_COMMIT"
echo "Tag: $TAG_NAME"
echo "Rollback branch: $ROLLBACK_BRANCH"
echo

# Check prerequisites
command -v git >/dev/null 2>&1 || { echo "git not found"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl not found"; exit 1; }

# 1) fetch and checkout main
echo "Fetching remote..."
git fetch "${REPO_REMOTE}"

echo "Checking out ${MAIN_BRANCH} ..."
git checkout "${MAIN_BRANCH}"
git pull "${REPO_REMOTE}" "${MAIN_BRANCH}"

# 2) ensure commit exists locally (if not, try fetching it)
if ! git cat-file -e "${STABLE_COMMIT}^{commit}" 2>/dev/null; then
  echo "Commit ${STABLE_COMMIT} not found locally; attempting to fetch..."
  # Try to fetch the commit/refs
  git fetch "${REPO_REMOTE}" "${STABLE_COMMIT}" || true
fi

if ! git cat-file -e "${STABLE_COMMIT}^{commit}" 2>/dev/null; then
  echo "ERROR: Commit ${STABLE_COMMIT} not found after fetch. Aborting."
  exit 2
fi
echo "Found commit ${STABLE_COMMIT}."

# 3) create annotated tag if not exists
if git rev-parse -q --verify "refs/tags/${TAG_NAME}" >/dev/null; then
  echo "Tag ${TAG_NAME} already exists locally."
else
  echo "Creating annotated tag ${TAG_NAME} -> ${STABLE_COMMIT}"
  git tag -a "${TAG_NAME}" "${STABLE_COMMIT}" -m "${TAG_MSG}"
fi

echo "Pushing tag ${TAG_NAME} to ${REPO_REMOTE} ..."
git push "${REPO_REMOTE}" "refs/tags/${TAG_NAME}"

# Verify remote tag
if git ls-remote --tags "${REPO_REMOTE}" | grep -q "${TAG_NAME}"; then
  echo "Tag ${TAG_NAME} pushed successfully."
else
  echo "WARNING: Tag push didn't show up in remote listing. Check network or permissions."
fi

# 4) ensure rollback branch exists on remote; if not, create from commit (fallback to main)
if git ls-remote --heads "${REPO_REMOTE}" | grep -q "refs/heads/${ROLLBACK_BRANCH}"; then
  echo "Rollback branch ${ROLLBACK_BRANCH} already exists on remote."
else
  echo "Rollback branch ${ROLLBACK_BRANCH} not found on remote. Creating..."
  # Create locally from the target commit if possible
  if git cat-file -e "${STABLE_COMMIT}^{commit}" 2>/dev/null; then
    git checkout -b "${ROLLBACK_BRANCH}" "${STABLE_COMMIT}"
  else
    echo "Target commit not present; creating rollback branch from ${MAIN_BRANCH} instead."
    git checkout -b "${ROLLBACK_BRANCH}" "${MAIN_BRANCH}"
  fi
  git push -u "${REPO_REMOTE}" "${ROLLBACK_BRANCH}"
  # return to main
  git checkout "${MAIN_BRANCH}"
fi

echo
echo "=== Optional local build verification (pnpm) ==="
if command -v pnpm >/dev/null 2>&1; then
  echo "Running pnpm install && pnpm prisma generate && pnpm run build ..."
  set +e
  pnpm install --silent
  # Run prisma generate without unsupported flags; don't fail the whole script if it errors
  pnpm prisma generate || echo "prisma generate failed (non-fatal)"
  pnpm run build
  BUILD_STATUS=$?
  set -e
  if [ "$BUILD_STATUS" -ne 0 ]; then
    echo "Build failed (exit $BUILD_STATUS). This does not change tag creation; investigate locally or in CI."
  else
    echo "Build succeeded."
  fi
else
  echo "pnpm not found; skipping build verification. Install pnpm to run build checks locally."
fi

# 5) Optional smoke tests if DEPLOY_URL and API_KEY_SHORTEN provided
if [ -n "${DEPLOY_URL}" ] && [ -n "${API_KEY_SHORTEN}" ]; then
  echo
  echo "=== Running smoke tests against ${DEPLOY_URL} ==="

  if [ -z "${TEST_SLUG}" ]; then
    echo "No TEST_SLUG provided; creating a short link via POST /api/shorten ..."
    CREATE_RESP=$(curl -sS -w "\n%{http_code}" -X POST "${DEPLOY_URL}/api/shorten" \
      -H "Authorization: Bearer ${API_KEY_SHORTEN}" -H "Content-Type: application/json" \
      -d '{"url":"https://example.com/test-from-smoke"}')
    HTTP_CODE=$(echo "${CREATE_RESP}" | tail -n1)
    BODY=$(echo "${CREATE_RESP}" | sed '$d')
    echo "POST /api/shorten returned HTTP ${HTTP_CODE}"
    if [ "${HTTP_CODE}" -ge 200 ] && [ "${HTTP_CODE}" -lt 300 ]; then
      echo "Create response: ${BODY}"
      # Note: parsing JSON in shell is fragile; user may prefer manual inspection
    else
      echo "Create short link failed; response body:"
      echo "${BODY}"
    fi
  fi

  if [ -n "${TEST_SLUG}" ]; then
    # crude parse if shortUrl present: remove protocol and host
    SLUG_ONLY="${TEST_SLUG}"
    SLUG_ONLY=$(echo "${TEST_SLUG}" | sed -E 's#https?://[^/]+/##; s#.*slug":"([^"]+)".*#\1#; s#.*shortUrl":"https?://[^/]+/([^"]+)".*#\1#')
    echo "Running GET /${SLUG_ONLY} ..."
    HTTP_HEAD=$(curl -sSI -o /dev/null -w "%{http_code}" "${DEPLOY_URL}/${SLUG_ONLY}")
    echo "GET /${SLUG_ONLY} returned HTTP ${HTTP_HEAD}"
  fi
else
  echo "DEPLOY_URL or API_KEY_SHORTEN not set; skipping smoke tests. To enable, export DEPLOY_URL and API_KEY_SHORTEN env vars."
fi

echo
echo "=== Done ==="
echo "Remote tag: ${TAG_NAME}"
echo "Remote rollback branch: ${ROLLBACK_BRANCH}"
