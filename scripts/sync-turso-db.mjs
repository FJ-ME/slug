import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function resolveDatabaseName() {
  const explicitName = process.env.TURSO_DATABASE_NAME?.trim();
  if (explicitName) return explicitName;

  const databaseUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const { hostname } = new URL(databaseUrl);
      if (hostname.endsWith(".turso.io")) {
        return hostname.slice(0, -".turso.io".length);
      }

      return hostname;
    } catch {
      return undefined;
    }
  }

  return "slug-vercel";
}

function resolveMigrationFolder() {
  const explicitFolder = process.argv[2] || process.env.PRISMA_MIGRATION_FOLDER;
  if (explicitFolder) return explicitFolder;

  const migrationsDir = resolve("prisma", "migrations");
  if (!existsSync(migrationsDir)) {
    return undefined;
  }

  const candidates = readdirSync(migrationsDir)
    .filter((name) => existsSync(resolve(migrationsDir, name, "migration.sql")))
    .sort()
    .reverse();

  return candidates[0];
}

const migrationFolder = resolveMigrationFolder();
const databaseName = resolveDatabaseName();
const migrationFile = migrationFolder
  ? resolve("prisma", "migrations", migrationFolder, "migration.sql")
  : undefined;

if (!migrationFolder || !migrationFile || !existsSync(migrationFile)) {
  console.error(
    "Unable to find the Prisma migration file. Pass the migration folder as an argument or set PRISMA_MIGRATION_FOLDER.",
  );
  process.exit(1);
}

if (!databaseName) {
  console.error(
    "Unable to determine the Turso database name. Set TURSO_DATABASE_NAME or TURSO_DATABASE_URL.",
  );
  process.exit(1);
}

const sql = readFileSync(migrationFile, "utf8");
const tursoArgs = ["db", "shell", databaseName];
const location = process.env.TURSO_LOCATION?.trim();

if (location) {
  tursoArgs.push("--location", location);
}

console.log(`Applying migration ${migrationFolder} to Turso database ${databaseName}...`);

try {
  execFileSync("turso", tursoArgs, {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
} catch (error) {
  console.error("Turso database sync failed.");
  console.error(
    "Make sure the Turso CLI is authenticated and the database exists, then rerun the command.",
  );
  process.exit(error?.status ?? 1);
}
