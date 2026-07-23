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
  if (result) {
    return true;
  }
  return false;
};

// 新增：白名单验证函数
export const checkAllowedEmail = async (email: string) => {
  // 单用户模式：只允许这个邮箱
  const allowedEmails = ['Sec.SD@2mail.co'];
  return allowedEmails.includes(email);
};
