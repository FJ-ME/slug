import { NextRequest, NextResponse } from "next/server";
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
    // Fallback on any error
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Basic request shape checks
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
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!safeEqual(token || undefined, env.API_KEY_SHORTEN)) {
      console.warn("Shorten API: invalid Bearer token");
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    // 3) Parse and validate body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { url } = body ?? {};
    if (!url) return NextResponse.json({ error: "Missing url field" }, { status: 400 });
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // 4) Generate slug and persist (retry on collision)
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const slug = generateSlug();
      try {
        const link = await db.links.create({
          data: {
            slug,
            url,
            // keep your userId logic - unchanged from previous implementation
            creatorId: "cms5j2sac0000duogwgkcrmi1",
          },
        });

        return NextResponse.json(
          { shortUrl: `${env.NEXT_PUBLIC_APP_URL}/${link.slug}` },
          { status: 201 },
        );
      } catch (err: any) {
        // If unique constraint on slug failed, retry; otherwise surface error
        const isUniqueViolation =
          err?.code === "P2002" || // Prisma unique constraint error code
          (err?.message && err.message.includes("Unique"));
        if (!isUniqueViolation) {
          console.error("Shorten API: DB error", err);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
        // else continue loop to retry with new slug
      }
    }

    // If we exhausted retries
    console.error("Shorten API: slug generation collision (too many attempts)");
    return NextResponse.json({ error: "Could not generate unique slug" }, { status: 500 });
  } catch (err) {
    console.error("Shorten API: unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
