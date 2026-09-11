import { Fragment } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { PricingTiersProvider } from "./context/PricingTiersContext";
import { Home } from "./pages/Home";
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
import { IntroCampaignLanding } from "./pages/IntroCampaignLanding";
import { IntroCampaignCheckout } from "./pages/IntroCampaignCheckout";
import { AgentPhoneLanding } from "./pages/AgentPhoneLanding";
import { Legal } from "./pages/Legal";
import { NotFound } from "./pages/NotFound";
import { FirstPromoterTracker } from "./components/FirstPromoterTracker";

/** Remount on /buy-leads ↔ /mls/:id ↔ /{listed|seller|buyer}/mls/:id so listing state does not carry over. */
function BuyLeadsScreen() {
  const { pathname } = useLocation();
  return <BuyLeads key={pathname} />;
}

/** Legacy /agent/:phone → /search/agent/:phone */
function LegacyAgentPhoneRedirect() {
  const { agentPhone } = useParams();
  if (!agentPhone) return <Navigate to="/buy-leads" replace />;
  return <Navigate to={`/search/agent/${encodeURIComponent(agentPhone)}`} replace />;
}

/** Legacy /sold/mls/… → /seller/mls/… */
function LegacySoldMlsRedirect() {
  const { mls } = useParams();
  const { search } = useLocation();
  if (!mls) return <Navigate to="/buy-leads" replace />;
  return <Navigate to={`/seller/mls/${mls}${search}`} replace />;
}

/**
 * Old pay links included an address slug (/listed/mls/TB8517024/18909-jebert-dr).
 * Strip the slug — MLS-only URL is canonical; listing still loads from GHL.
 */
function MlsAddressSlugRedirect({ segment }: { segment: "listed" | "seller" | "buyer" | "mls" | "sold" }) {
  const { mls } = useParams();
  const { search } = useLocation();
  if (!mls) return <Navigate to="/buy-leads" replace />;
  const target =
    segment === "sold"
      ? `/seller/mls/${mls}${search}`
      : segment === "mls"
        ? `/mls/${mls}${search}`
        : `/${segment}/mls/${mls}${search}`;
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <PricingTiersProvider>
    <Fragment>
    <FirstPromoterTracker />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/buy-leads" element={<BuyLeadsScreen />} />
      <Route path="/listed/mls/:mls/:addressSlug" element={<MlsAddressSlugRedirect segment="listed" />} />
      <Route path="/listed/mls/:mls" element={<BuyLeadsScreen />} />
      <Route path="/seller/mls/:mls/:addressSlug" element={<MlsAddressSlugRedirect segment="seller" />} />
      <Route path="/seller/mls/:mls" element={<BuyLeadsScreen />} />
      <Route path="/buyer/mls/:mls/:addressSlug" element={<MlsAddressSlugRedirect segment="buyer" />} />
      <Route path="/buyer/mls/:mls" element={<BuyLeadsScreen />} />
      <Route path="/sold/mls/:mls/:addressSlug" element={<MlsAddressSlugRedirect segment="sold" />} />
      <Route path="/sold/mls/:mls" element={<LegacySoldMlsRedirect />} />
      <Route path="/mls/:mls/:addressSlug" element={<MlsAddressSlugRedirect segment="mls" />} />
      <Route path="/mls/:mls" element={<BuyLeadsScreen />} />
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
      <Route path="/first-time-customer/checkout" element={<IntroCampaignCheckout />} />
      <Route path="/first-time-customer/:agentPhone" element={<IntroCampaignLanding />} />
      <Route path="/first-time-customer" element={<IntroCampaignLanding />} />
      <Route path="/search/agent/:agentPhone" element={<AgentPhoneLanding />} />
      <Route path="/agent/:agentPhone" element={<LegacyAgentPhoneRedirect />} />
      <Route path="/privacy-policy" element={<Legal kind="privacy" />} />
      <Route path="/terms-and-conditions" element={<Legal kind="terms" />} />
      <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
      <Route path="/terms" element={<Navigate to="/terms-and-conditions" replace />} />
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
