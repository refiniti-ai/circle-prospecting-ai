import { SignJWT, jwtVerify } from "jose";

const getSecret = () => {
  const s = process.env.DASHBOARD_JWT_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DASHBOARD_JWT_SECRET must be at least 32 characters in production");
    }
  }
  return new TextEncoder().encode((s || "dev-only-unsafe-secret-change-in-production-32ch").slice(0, 64));
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
