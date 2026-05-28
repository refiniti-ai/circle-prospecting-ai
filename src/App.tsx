import { Fragment } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { PricingTiersProvider } from "./context/PricingTiersContext";
import { Home } from "./pages/Home";
import { LeadsPage } from "./pages/LeadsPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { CoveragePage } from "./pages/CoveragePage";
import { CampaignPricingPage } from "./pages/CampaignPricingPage";
import { ContactPage } from "./pages/ContactPage";
import { Order } from "./pages/Order";
import { OrderSuccess } from "./pages/OrderSuccess";
import { QuoteInvoicePage } from "./pages/QuoteInvoicePage";
import { BuyLeads } from "./pages/BuyLeads";
import { DashboardLeads } from "./pages/DashboardLeads";
import { LoginPage } from "./pages/LoginPage";
import { AdminLeads } from "./pages/AdminLeads";
import { AdminPurchases } from "./pages/AdminPurchases";
import { AdminDashboard } from "./pages/AdminDashboard";
import { GenerateCheckoutPage } from "./pages/GenerateCheckoutPage";
import { PayLinkPage } from "./pages/PayLinkPage";
import { Legal } from "./pages/Legal";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <PricingTiersProvider>
    <Fragment>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/coverage" element={<CoveragePage />} />
      <Route path="/campaign-pricing" element={<CampaignPricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/content" element={<Navigate to="/contact" replace />} />
      <Route path="/buy-leads" element={<BuyLeads />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardLeads />} />
      <Route path="/admin/login" element={<Navigate to="/login?tab=admin" replace />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/leads" element={<AdminLeads />} />
      <Route path="/admin/purchases" element={<AdminPurchases />} />
      <Route path="/admin/generate-checkout" element={<GenerateCheckoutPage />} />
      <Route path="/pay/:contactId" element={<PayLinkPage />} />
      <Route path="/order/success" element={<OrderSuccess />} />
      <Route path="/quote" element={<QuoteInvoicePage />} />
      <Route path="/invoice" element={<QuoteInvoicePage />} />
      <Route path="/order/:id" element={<Order />} />
      <Route path="/privacy" element={<Legal kind="privacy" />} />
      <Route path="/terms" element={<Legal kind="terms" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <Toaster
      containerStyle={{ top: 72, zIndex: 10050 }}
      gutter={12}
      toastOptions={{ duration: 5000 }}
    />
    </Fragment>
    </PricingTiersProvider>
  );
}
