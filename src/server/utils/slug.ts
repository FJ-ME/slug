import crypto from "crypto";
import { env } from "@/env.mjs";

/**
 * Generate an alphanumeric slug of given length.
 * Uses crypto.randomBytes for sufficient entropy.
 * SLUG length can be configured via env.SLUG_LENGTH (string -> coerced to number).
 */
export function generateSlug(length?: number): string {
  const defaultLength = (() => {
    const v = env.SLUG_LENGTH;
    const n = v ? Number(v) : undefined;
    if (Number.isInteger(n) && n! > 0) return n!;
    return 6;
  })();

  const L = typeof length === "number" && Number.isInteger(length) && length > 0 ? length : defaultLength;

  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(L);
  if (bytes.length < L) {
    throw new Error("Not enough random bytes generated");
  }
  let id = "";
  for (let i = 0; i < L; i++) {
    const b = bytes.readUInt8(i); // safe read
    id += alphabet[b % alphabet.length];
  }
  return id;
}
