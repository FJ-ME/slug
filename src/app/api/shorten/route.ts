import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/server/db";
import { generateSlug } from "@/server/utils/slug";
import { env } from "@/env.mjs";

function safeEqual(a?: string, b?: string) {
  if (!a || !b) return false;
  try {
    const A = Buffer.from(a);
    const B = Buffer.from(b);
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
}

function isUniqueError(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: unknown; message?: unknown };
    if (e.code === "P2002") return true;
    const msg = e.message;
    return typeof msg === "string" && msg.includes("Unique");
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 400 });
    }

    // 1) Verify Cloudflare-injected signature header (x-sig)
    const sig = request.headers.get("x-sig");
    if (!safeEqual(sig ?? undefined, env.CF_SIGNATURE)) {
      console.warn("Shorten API: invalid or missing x-sig");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Verify Bearer token (primary secret)
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!safeEqual(token ?? undefined, env.API_KEY_SHORTEN)) {
      console.warn("Shorten API: invalid Bearer token");
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    // 3) Parse and validate body (use unknown + runtime checks to avoid any)
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const maybeUrl = (body as Record<string, unknown>).url;
    if (typeof maybeUrl !== "string") {
      return NextResponse.json({ error: "Missing or invalid url field" }, { status: 400 });
    }
    try {
      new URL(maybeUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    const url = maybeUrl;

    // 4) Generate slug and persist (retry on collision)
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const slug = generateSlug();
      try {
        const link = await db.links.create({
          data: {
            slug,
            url,
            // 项目模型 uses creatorId
            creatorId: "cms5j2sac0000duogwgkcrmi1",
          },
        });

        const baseUrl = env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";
        return NextResponse.json({ shortUrl: `${baseUrl}/${link.slug}` }, { status: 201 });
      } catch (err: unknown) {
        const isUnique = isUniqueError(err);
        if (!isUnique) {
          console.error("Shorten API: DB error", err);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
        // 如果是唯一约束冲突，则循环重试
      }
    }

    console.error("Shorten API: slug generation collision (too many attempts)");
    return NextResponse.json({ error: "Could not generate unique slug" }, { status: 500 });
  } catch (err) {
    console.error("Shorten API: unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
