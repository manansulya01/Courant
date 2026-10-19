import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Create a classroom code using uniform cryptographic sampling. */
export function generateClassJoinCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** Accept legacy four-character codes while new classrooms use eight characters. */
export function normalizeClassJoinCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^(?:[A-Z0-9]{4}|[A-Z0-9]{8})$/.test(normalized) ? normalized : null;
}
