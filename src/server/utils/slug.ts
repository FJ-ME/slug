import crypto from "crypto";

/**
 * Generate an alphanumeric slug of given length.
 * Uses crypto.randomBytes for sufficient entropy.
 */
export function generateSlug(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}
