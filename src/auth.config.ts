import type { NextAuthConfig } from "next-auth";
import Github from "next-auth/providers/github";

import { env } from "./env.mjs";

export default {
  providers: [
    Github({
      clientId: env.GITHUB_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          // Request access to user's email addresses in case primary email is private
          scope: "read:user user:email",
        },
      },
    }),
  ],
} satisfies NextAuthConfig;
