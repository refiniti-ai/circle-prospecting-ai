import { Navigate } from "react-router-dom";

/** @deprecated Use `/admin?tab=purchases` */
export function AdminPurchases() {
  return <Navigate to="/admin?tab=purchases" replace />;
}
