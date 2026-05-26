import "server-only";

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "acc_admin_session";

const DEFAULT_ADMIN_PASSCODE = "accadmin";
const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export function getAdminPasscodeHint(): string | null {
  if (process.env.NODE_ENV === "production" || hasConfiguredPasscode()) {
    return null;
  }

  return DEFAULT_ADMIN_PASSCODE;
}

export function isAdminPasscode(passcode: string): boolean {
  const expectedHash = hashValue(getAdminPasscode());
  const actualHash = hashValue(passcode.trim());
  return safeEqual(expectedHash, actualHash);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionValue) {
    return false;
  }

  return safeEqual(sessionValue, getSessionValue());
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, getSessionValue(), {
    httpOnly: true,
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

function getAdminPasscode(): string {
  return (
    process.env.ACC_ADMIN_PASSCODE?.trim() ||
    process.env.ADMIN_PASSCODE?.trim() ||
    DEFAULT_ADMIN_PASSCODE
  );
}

function hasConfiguredPasscode(): boolean {
  return Boolean(
    process.env.ACC_ADMIN_PASSCODE?.trim() || process.env.ADMIN_PASSCODE?.trim(),
  );
}

function getSessionValue(): string {
  return hashValue(`acc-admin:${getAdminPasscode()}`);
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
