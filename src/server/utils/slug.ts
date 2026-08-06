import crypto from "crypto";

/**
 * Generate an alphanumeric slug of given length.
 * Uses crypto.randomBytes for sufficient entropy.
 */
export function generateSlug(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  if (bytes.length < length) {
    throw new Error("Not enough random bytes generated");
  }
  let id = "";
  for (let i = 0; i < length; i++) {
    const b = bytes.readUInt8(i); // safe read
    id += alphabet[b % alphabet.length];
  }
  return id;
}
