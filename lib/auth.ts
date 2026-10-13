import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

const scrypt = promisify(scryptCallback);
const COOKIE = "courant_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
export type Role = "student" | "teacher" | "parent" | "admin";
export type SafeUser = { id: string; name: string; email: string; role: Role };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  return value;
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
function equal(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, digest] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  return equal(actual.toString("hex"), digest);
}
export async function setSession(user: SafeUser) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(Date.now()/1000) + SESSION_SECONDS })).toString("base64url");
  const value = payload + "." + sign(payload);
  const jar = await cookies();
  jar.set(COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}
export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const jar = await cookies();
    const value = jar.get(COOKIE)?.value;
    if (!value) return null;
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra || !equal(sign(payload), signature)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {sub:string; role:Role; exp:number};
    if (!session.sub || !ObjectId.isValid(session.sub) || session.exp < Math.floor(Date.now()/1000)) return null;
    const db = await getDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(session.sub), status: "active" });
    if (!user || !["student","teacher","parent","admin"].includes(user.role)) return null;
    return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
  } catch { return null; }
}
export function safeUser(user: { _id: ObjectId; name: string; email: string; role: Role }): SafeUser {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}
export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && ObjectId.isValid(value);
}
