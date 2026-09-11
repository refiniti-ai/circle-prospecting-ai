import { Navigate } from "react-router-dom";

/** @deprecated Inventory tab removed — send to overview. */
export function AdminLeads() {
  return <Navigate to="/admin?tab=overview" replace />;
}
