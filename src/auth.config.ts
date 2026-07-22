import type { NextAuthConfig } from "next-auth";
import Github from "next-auth/providers/github";

import { env } from "./env.mjs";

export default {
  providers: [
    Github({
      clientId: env.GITHUB_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
  ],
} satisfies NextAuthConfig;
