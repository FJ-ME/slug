#!/usr/bin/env bash
set -euo pipefail

# Usage:
# 1) make executable: chmod +x scripts/codespace-unlimit.sh
# 2) export DATABASE_URL="..." (or set in Codespaces Secrets)
# 3) For single user: ./scripts/codespace-unlimit.sh --user you@domain.com
#    For all users : ./scripts/codespace-unlimit.sh --all
# 4) The script will ask for confirmation before making changes.

DB_URL="${DATABASE_URL:-}"

print_usage() {
  cat <<EOF
Usage:
  scripts/codespace-unlimit.sh --user EMAIL    # set one user's limitLinks = 0
  scripts/codespace-unlimit.sh --all           # set ALL users limitLinks = 0 (uses scripts/set-unlimited.ts)
  scripts/codespace-unlimit.sh --help
Notes:
  - Ensure DATABASE_URL is set in the environment.
  - For --all the repo already contains scripts/set-unlimited.ts; the script will run it with npx ts-node.
  - The script tries to backup before modifying: uses pg_dump if DATABASE_URL looks like Postgres and pg_dump exists; otherwise uses Prisma to create a backup table.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "" ]]; then
  print_usage
  exit 0
fi

MODE=""
TARGET_EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      MODE="user"
      TARGET_EMAIL="$2"
      shift 2
      ;;
    --all)
      MODE="all"
      shift
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      print_usage
      exit 1
      ;;
  esac
done

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL is not set. Export DATABASE_URL before running."
  exit 1
fi

# Helpers
timestamp() { date -u +"%Y%m%dT%H%M%SZ"; }

backup_with_pg_dump() {
  echo "Attempting pg_dump backup..."
  local dumpfile="backup_user_limit_$(timestamp).dump"
  # If DATABASE_URL is a full URL, pg_dump can accept it via PG* env vars or --dbname
  if command -v pg_dump >/dev/null 2>&1; then
    echo "Running: pg_dump --format=custom --file=${dumpfile} --no-owner --no-acl \"${DB_URL}\""
    pg_dump --format=custom --file="${dumpfile}" --no-owner --no-acl "${DB_URL}"
    echo "pg_dump saved to $(pwd)/${dumpfile}"
    return 0
  else
    echo "pg_dump not found. Skipping pg_dump backup."
    return 1
  fi
}

backup_with_prisma_table() {
  echo "Creating backup table user_limit_backup via Prisma (in-DB copy)..."
  # Make an internal backup table (may require CREATE TABLE privilege)
  npx prisma db execute --sql "DROP TABLE IF EXISTS user_limit_backup;"
  npx prisma db execute --sql "CREATE TABLE user_limit_backup AS SELECT id, email, \"limitLinks\" FROM \"User\";"
  echo "Backup table 'user_limit_backup' created in DB."
}

do_backup() {
  # If DB looks like Postgres and pg_dump exists, use pg_dump else use prisma backup table
  if [[ "$DB_URL" == postgres:* || "$DB_URL" == postgresql:* ]] && command -v pg_dump >/dev/null 2>&1; then
    backup_with_pg_dump || backup_with_prisma_table
  else
    # fallback: prisma table backup
    backup_with_prisma_table
  fi
}

confirm() {
  read -r -p "Proceed with the update? Type 'YES' to continue: " ans
  if [[ "$ans" != "YES" ]]; then
    echo "Aborted by user."
    exit 0
  fi
}

# Start
echo "Codespace Unlimit Script"
echo "Mode: $MODE"
if [[ "$MODE" == "user" ]]; then
  echo "Target email: $TARGET_EMAIL"
fi

echo
echo "Step 1: Backup"
do_backup

echo
echo "Step 2: Preview changes (no changes made yet)"
if [[ "$MODE" == "user" ]]; then
  echo "Current value for user with email ${TARGET_EMAIL}:"
  npx prisma db execute --sql "SELECT id, email, \"limitLinks\" FROM \"User\" WHERE email = '${TARGET_EMAIL}';" || true
else
  echo "Number of users currently with limitLinks = 0:"
  npx prisma db execute --sql "SELECT COUNT(*) FROM \"User\" WHERE \"limitLinks\" = 0;" || true
fi

echo
echo "Step 3: Confirmation"
confirm

echo
echo "Step 4: Apply changes"
if [[ "$MODE" == "user" ]]; then
  echo "Updating single user to limitLinks = 0..."
  npx prisma db execute --sql "UPDATE \"User\" SET \"limitLinks\" = 0 WHERE email = '${TARGET_EMAIL}';"
  echo "Update done. Verifying..."
  npx prisma db execute --sql "SELECT id, email, \"limitLinks\" FROM \"User\" WHERE email = '${TARGET_EMAIL}';"
else
  echo "Running repository script to set all users unlimited..."
  # Ensure ts-node is available; install dev deps if necessary
  if ! command -v ts-node >/dev/null 2>&1; then
    echo "ts-node not found. Installing temporarily in the workspace (dev deps)..."
    pnpm add -D ts-node typescript @types/node || npm i -D ts-node typescript @types/node
  fi
  npx ts-node scripts/set-unlimited.ts
  echo "Verification: count users with limitLinks = 0"
  npx prisma db execute --sql "SELECT COUNT(*) FROM \"User\" WHERE \"limitLinks\" = 0;"
fi

echo
echo "Done. If you want to revert, restore from the backup you created (or restore values from user_limit_backup table)."
