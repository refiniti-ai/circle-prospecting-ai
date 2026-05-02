import { Navigate } from "react-router-dom";

/** @deprecated Use `/admin?tab=inventory` */
export function AdminLeads() {
  return <Navigate to="/admin?tab=inventory" replace />;
}
