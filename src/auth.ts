import { checkBlockedEmail, checkAllowedEmail } from "./server/actions/auth";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/server/db";
import authConfig from "@/auth.config";
import { getUserById } from "./server/utils/user";
import { getTwoFactorConfirmationByUserId } from "./server/utils/two-factor-confirm";
import { getAccountByUserId } from "./server/utils/account";
import { env } from "./env.mjs";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
  unstable_update,
} = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  basePath: "/api/auth",
  secret: env.AUTH_SECRET,
  pages: {
    signIn: "/auth",
    error: "/auth/error",
  },
  events: {
    async linkAccount({ user }) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // If provider is github, try to fetch verified/primary email via GitHub API
      if (account?.provider === "github") {
        try {
          // account may include access_token when using OAuth
          const acct = account as { access_token?: string } | undefined;
          const token = acct?.access_token;
          if (token) {
            const resp = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json",
              },
            });
            if (resp.ok) {
              const emails = (await resp.json()) as Array<{
                email: string;
                primary?: boolean;
                verified?: boolean;
                visibility?: string | null;
              }>;
              // emails is an array of { email, primary, verified, visibility }
              const primary =
                emails.find((e) => e.primary && e.verified)?.email ||
                emails.find((e) => e.verified)?.email;
              if (primary) {
                // override user.email so subsequent checks use the verified primary email
                user.email = primary;
              }
            } else {
              console.error("Failed to fetch GitHub emails", await resp.text());
            }
          }
        } catch (err) {
          console.error("Error fetching github emails in signIn callback", err);
        }
      }

      // Allow OAuth (non-credentials) sign-ins without local credentials-only whitelist/verification checks
      if (account?.provider !== "credentials") return true;

      // 白名单验证（仅对 credentials 登录方式生效）
      const isAllowed = await checkAllowedEmail(user.email!);
      if (!isAllowed) return false;

      const existingUser = await getUserById(user.id);

      // Disable sign in for blocked users
      const emailBlocked = await checkBlockedEmail(user.email!);

      if (emailBlocked) return false;

      // Prevent sign in without email verification
      if (!existingUser?.emailVerified) return false;

      if (existingUser.isTwoFactorEnabled) {
        const twoFactorConfirmation = await getTwoFactorConfirmationByUserId(
          existingUser.id,
        );

        if (!twoFactorConfirmation) return false;

        // Delete two factor confirmation for next sign in
        await db.twoFactorConfirmation.delete({
          where: { id: twoFactorConfirmation.id },
        });
      }

      return true;
    },
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      if (session.user) {
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
      }

      if (session.user) {
        session.user.name = token.name;
        session.user.email = token.email!;
        session.user.isOAuth = token.isOAuth as boolean;
        session.user.limitLinks = token.limitLinks as number;
        session.user.blocked = token.blocked as boolean;
      }

      return session;
    },
    async jwt({ token }) {
      if (!token.sub) return token;

      const existingUser = await getUserById(token.sub);

      if (!existingUser) return token;

      const existingAccount = await getAccountByUserId(existingUser.id);

      token.isOAuth = !!existingAccount;
      token.name = existingUser.name;
      token.email = existingUser.email;
      token.role = existingUser.role;
      token.isTwoFactorEnabled = existingUser.isTwoFactorEnabled;
      token.limitLinks = existingUser.limitLinks;
      token.blocked = existingUser.blocked;

      return token;
    },
  },
  ...authConfig,
});
