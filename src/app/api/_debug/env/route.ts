import { NextResponse } from "next/server";

export async function GET() {
  try {
    const envInfo = {
      hasGithubId: !!process.env.GITHUB_ID,
      hasGithubSecret: !!process.env.GITHUB_CLIENT_SECRET,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV ?? null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(envInfo, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "failed to read env" }, { status: 500 });
  }
}
