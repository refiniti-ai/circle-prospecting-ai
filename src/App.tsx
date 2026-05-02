import { Routes, Route } from "react-router-dom";
import { PricingTiersProvider } from "./context/PricingTiersContext";
import { Home } from "./pages/Home";
import { LeadsPage } from "./pages/LeadsPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { CoveragePage } from "./pages/CoveragePage";
import { CampaignPricingPage } from "./pages/CampaignPricingPage";
import { ContentPage } from "./pages/ContentPage";
import { Order } from "./pages/Order";
import { OrderSuccess } from "./pages/OrderSuccess";
import { BuyLeads } from "./pages/BuyLeads";
import { DashboardLeads } from "./pages/DashboardLeads";
import { AdminLeads } from "./pages/AdminLeads";
import { AdminPurchases } from "./pages/AdminPurchases";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Legal } from "./pages/Legal";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <PricingTiersProvider>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/coverage" element={<CoveragePage />} />
      <Route path="/campaign-pricing" element={<CampaignPricingPage />} />
      <Route path="/content" element={<ContentPage />} />
      <Route path="/buy-leads" element={<BuyLeads />} />
      <Route path="/dashboard" element={<DashboardLeads />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/leads" element={<AdminLeads />} />
      <Route path="/admin/purchases" element={<AdminPurchases />} />
      <Route path="/order/success" element={<OrderSuccess />} />
      <Route path="/order/:id" element={<Order />} />
      <Route path="/privacy" element={<Legal kind="privacy" />} />
      <Route path="/terms" element={<Legal kind="terms" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </PricingTiersProvider>
  );
}
