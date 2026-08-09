// GET /:slug - redirect and increment clicks
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params?.slug;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  try {
    const updated = await db.links.update({
      where: { slug },
      data: { clicks: { increment: 1 }, lastClicked: new Date() },
      select: { url: true },
    });

    if (!updated?.url) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.redirect(updated.url, 302);
  } catch (err: unknown) {
    const e = err as { code?: unknown; message?: unknown };
    const notFound = e.code === "P2025" || (typeof e.message === "string" && e.message.includes("No record found"));
    if (notFound) return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("Redirect/lookup error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
