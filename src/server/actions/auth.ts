"use server";

import { signOut } from "@/auth";
import { db } from "../db";

export const handleSignOut = async () => {
  await signOut();
};

export const checkBlockedEmail = async (email: string) => {
  const result = await db.blockedEmails.findFirst({
    where: {
      email,
    },
  });
  return !!result;
};

// 白名单验证：从环境变量读取，逗号分隔；若未配置则默认允许（可改为默认拒绝）
export const checkAllowedEmail = async (email: string) => {
  const envList = process.env.ALLOWED_EMAILS;
  if (!envList) return true;
  const allowed = envList.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes((email || "").toLowerCase());
};
