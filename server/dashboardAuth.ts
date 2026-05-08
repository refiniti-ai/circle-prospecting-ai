import { SignJWT, jwtVerify } from "jose";

/** JWT signing key: optional env override; otherwise a built-in default (set DASHBOARD_JWT_SECRET for a unique key). */
const getSecret = () => {
  const s = process.env.DASHBOARD_JWT_SECRET?.trim();
  const material =
    s && s.length >= 16 ? s : "dev-only-unsafe-secret-change-in-production-32ch";
  return new TextEncoder().encode(material.slice(0, 64));
};

export async function signDashboardToken(email: string) {
  const e = email.trim().toLowerCase();
  return new SignJWT({ typ: "dashboard", em: e })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(e)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getSecret());
}

export async function verifyDashboardToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const em = (payload as { em?: string }).em;
    if (typeof em === "string" && em.includes("@")) return em.toLowerCase();
    if (typeof payload.sub === "string" && payload.sub.includes("@")) return payload.sub.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

/** Short-lived token after /api/auth/admin-login (username + password). */
export async function signAdminToken(): Promise<string> {
  return new SignJWT({ typ: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload as { typ?: string }).typ === "admin";
  } catch {
    return false;
  }
}
