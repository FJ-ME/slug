import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import { env } from "@/env.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const shouldUseTurso = Boolean(env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN);

if (env.NODE_ENV === "production" && !shouldUseTurso) {
  throw new Error(
    "Production requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to be configured.",
  );
}

const prismaConfig = {
  log:
    env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
} as Record<string, unknown>;

if (shouldUseTurso) {
  const libsql = createClient({
    url: env.TURSO_DATABASE_URL ?? "",
    authToken: env.TURSO_AUTH_TOKEN ?? "",
  });

  Object.assign(prismaConfig, {
    adapter: new PrismaLibSQL(libsql),
  });
}

export const db =
  globalForPrisma.prisma ?? new PrismaClient(prismaConfig as never);

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
