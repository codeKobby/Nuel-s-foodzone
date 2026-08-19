export const DEFAULT_MANAGER_EMAIL = "nuelgee54@gmail.com";

/**
 * The manager email is intentionally public configuration: it is an allowlist
 * identifier, not a password or credential. Authorization must still require
 * a verified Firebase ID token and the manager role claim.
 */
export const MANAGER_EMAIL = (
  process.env.NEXT_PUBLIC_MANAGER_EMAIL || DEFAULT_MANAGER_EMAIL
).trim().toLowerCase();

export type StaffRole = "manager" | "cashier" | "kitchen";
export type BackofficeRole = Exclude<StaffRole, "kitchen">;

export function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function isAllowedManagerEmail(
  email: string | null | undefined
): boolean {
  return normalizeEmail(email) === MANAGER_EMAIL;
}

/**
 * Resolve the UI role from trusted Firebase ID-token claims.
 *
 * The email allowlist prevents a wrongly configured manager claim from
 * granting manager access to another account. The claim itself must be set
 * from a privileged server/admin environment; the browser must never invent
 * it through local state.
 */
export function resolveStaffRole(
  claims: Record<string, unknown>,
  email: string | null | undefined
): StaffRole | null {
  const role = claims.role;

  if (role === "manager") {
    return isAllowedManagerEmail(email) ? "manager" : null;
  }

  if (role === "cashier") {
    return "cashier";
  }

  if (role === "kitchen") {
    return "kitchen";
  }

  return null;
}
