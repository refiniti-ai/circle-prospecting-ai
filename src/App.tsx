import { Fragment } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { PricingTiersProvider } from "./context/PricingTiersContext";
import { Home } from "./pages/Home";
import { LeadsPage } from "./pages/LeadsPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
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
import { IntroCampaignLanding } from "./pages/IntroCampaignLanding";
import { IntroCampaignCheckout } from "./pages/IntroCampaignCheckout";
import { IntroCampaignMlsPage, IntroCampaignSegmentPage } from "./pages/IntroCampaignSegmentPage";
import { AgentPhoneLanding } from "./pages/AgentPhoneLanding";
import { Legal } from "./pages/Legal";
import { NotFound } from "./pages/NotFound";
import { FirstPromoterTracker } from "./components/FirstPromoterTracker";
import { MetaPixelTracker } from "./components/MetaPixelTracker";

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

function IntroPromoMlsSlugRedirect({ campaign }: { campaign: "listed" | "seller" | "buyer" }) {
  const { mls } = useParams();
  const { search } = useLocation();
  if (!mls) return <Navigate to={`/99promo${search}`} replace />;
  return <Navigate to={`/99promo/${campaign}/mls/${mls}${search}`} replace />;
}

function IntroPromoBareMlsRedirect() {
  const { mls } = useParams();
  const { search } = useLocation();
  if (!mls) return <Navigate to={`/99promo${search}`} replace />;
  return <Navigate to={`/99promo/listed/mls/${mls}${search}`} replace />;
}

function LegacyIntroPathRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function LegacyIntroAgentRedirect() {
  const { agentPhone } = useParams();
  const { search } = useLocation();
  if (!agentPhone) return <Navigate to={`/99promo${search}`} replace />;
  return <Navigate to={`/99promo/search/agent/${encodeURIComponent(agentPhone)}${search}`} replace />;
}

export default function App() {
  return (
    <PricingTiersProvider>
    <Fragment>
    <FirstPromoterTracker />
    <MetaPixelTracker />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/coverage" element={<Navigate to="/how-it-works" replace />} />
      <Route path="/campaign-pricing" element={<CampaignPricingPage />} />
      <Route path="/pricing" element={<Navigate to="/campaign-pricing" replace />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/content" element={<Navigate to="/contact" replace />} />
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
      <Route path="/99promo/checkout" element={<IntroCampaignCheckout />} />
      <Route path="/99promo/search/agent/:agentPhone" element={<IntroCampaignLanding />} />
      <Route path="/99promo/listed/mls/:mls/:addressSlug" element={<IntroPromoMlsSlugRedirect campaign="listed" />} />
      <Route path="/99promo/listed/mls/:mls" element={<IntroCampaignMlsPage campaign="listed" />} />
      <Route path="/99promo/seller/mls/:mls/:addressSlug" element={<IntroPromoMlsSlugRedirect campaign="seller" />} />
      <Route path="/99promo/seller/mls/:mls" element={<IntroCampaignMlsPage campaign="seller" />} />
      <Route path="/99promo/buyer/mls/:mls/:addressSlug" element={<IntroPromoMlsSlugRedirect campaign="buyer" />} />
      <Route path="/99promo/buyer/mls/:mls" element={<IntroCampaignMlsPage campaign="buyer" />} />
      <Route path="/99promo/mls/:mls/:addressSlug" element={<IntroPromoBareMlsRedirect />} />
      <Route path="/99promo/mls/:mls" element={<IntroPromoBareMlsRedirect />} />
      <Route path="/99promo" element={<IntroCampaignLanding />} />
      <Route path="/first-time-customer/checkout" element={<LegacyIntroPathRedirect to="/99promo/checkout" />} />
      <Route path="/first-time-customer/search/agent/:agentPhone" element={<LegacyIntroAgentRedirect />} />
      <Route path="/first-time-customer/:segment" element={<IntroCampaignSegmentPage />} />
      <Route path="/first-time-customer" element={<LegacyIntroPathRedirect to="/99promo" />} />
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
