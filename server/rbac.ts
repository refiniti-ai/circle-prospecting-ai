import type { NextFunction, Request, Response } from "express";

export type TenantRole = "owner" | "admin" | "agent" | "viewer";

export type RequestActor = {
  tenantId: string;
  userId: string;
  role: TenantRole;
};

declare global {
  namespace Express {
    interface Request {
      actor?: RequestActor;
    }
  }
}

export function requireActor(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.get("X-Tenant-Id") || "default";
  const userId = req.get("X-User-Id") || "anonymous";
  const role = (req.get("X-User-Role") || "viewer") as TenantRole;
  if (!["owner", "admin", "agent", "viewer"].includes(role)) {
    res.status(400).json({ error: "invalid role" });
    return;
  }
  req.actor = { tenantId, userId, role };
  next();
}

export function requireRole(minRole: TenantRole) {
  const rank: Record<TenantRole, number> = { viewer: 0, agent: 1, admin: 2, owner: 3 };
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = req.actor;
    if (!actor) {
      res.status(401).json({ error: "actor required" });
      return;
    }
    if (rank[actor.role] < rank[minRole]) {
      res.status(403).json({ error: "insufficient role", required: minRole, have: actor.role });
      return;
    }
    next();
  };
}
