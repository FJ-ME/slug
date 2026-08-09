import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

function isPrismaNotFoundError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const maybe = e as { code?: unknown; message?: unknown };
  if (maybe.code === "P2025") return true;
  return typeof maybe.message === "string" && maybe.message.includes("No record found");
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params?.slug;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  try {
    // Primary: try atomic increment (fast path)
    const updated = await db.links.update({
      where: { slug },
      data: { clicks: { increment: 1 }, lastClicked: new Date() },
      select: { url: true },
    });

    if (!updated?.url) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.redirect(updated.url, 302);
  } catch (err: unknown) {
    if (isPrismaNotFoundError(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fallback: transaction-based find + update (compatible)
    try {
      const result = await db.$transaction(async (tx) => {
        const row = await tx.links.findUnique({ where: { slug }, select: { id: true, url: true, clicks: true } });
        if (!row) throw new Error("NOT_FOUND_IN_TX");
        await tx.links.update({ where: { id: row.id }, data: { clicks: row.clicks + 1, lastClicked: new Date() } });
        return row.url;
      });

      return NextResponse.redirect(result, 302);
    } catch (txErr: unknown) {
      console.error("Redirect/lookup error (primary and fallback failed)", { err, txErr });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
}
