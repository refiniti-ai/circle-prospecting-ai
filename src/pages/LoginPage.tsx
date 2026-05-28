import { useEffect, useState } from "react";
import { notifyError, notifyInfo, notifyWarning } from "../lib/notify";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SeoHead } from "../components/SeoHead";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import {
  clientLogin,
  completeClientPasswordReset,
  fetchAdminSummary,
  loginAdmin,
  requestClientPasswordReset,
} from "../lib/leadsApi";

const TOKEN_KEY = "cpai_dash_jwt";
/** Session JWT after admin username/password (not the legacy API key). */
const ADMIN_SESSION_KEY = "cpai_admin_jwt";

type Tab = "client" | "admin";

type LocationState = { resetDone?: boolean };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientResetToken = searchParams.get("client_reset")?.trim() ?? "";
  const tab: Tab = searchParams.get("tab") === "admin" ? "admin" : "client";

  const resetDone = Boolean((location.state as LocationState | null)?.resetDone);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientBusy, setClientBusy] = useState(false);

  const [showClientForgot, setShowClientForgot] = useState(false);
  const [clientForgotEmail, setClientForgotEmail] = useState("");
  const [clientForgotBusy, setClientForgotBusy] = useState(false);

  const [adminUser, setAdminUser] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminBoot, setAdminBoot] = useState(true);

  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (!resetDone) return;
    notifyInfo("Password updated. Sign in below.", { id: "login-password-updated" });
  }, [resetDone]);

  /** Old emailed admin reset links pointed here; strip param and point users to in-dashboard change. */
  useEffect(() => {
    const raw = searchParams.get("admin_reset")?.trim();
    if (!raw) return;
    notifyInfo(
      "Admin password is changed from the dashboard after you sign in: Admin → Account tab → Change admin password.",
      { id: "admin-reset-deprecated" }
    );
    const p = new URLSearchParams(searchParams);
    p.delete("admin_reset");
    setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (tab !== "admin") {
      setAdminBoot(false);
      return;
    }
    const saved = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? sessionStorage.getItem("cpai_admin_key");
    if (!saved) {
      setAdminBoot(false);
      return;
    }
    setAdminBusy(true);
    fetchAdminSummary(saved)
      .then(() => navigate("/admin", { replace: true }))
      .catch(() => {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        sessionStorage.removeItem("cpai_admin_key");
        setAdminPassword("");
      })
      .finally(() => {
        setAdminBusy(false);
        setAdminBoot(false);
      });
  }, [tab, navigate]);

  function setTab(next: Tab) {
    const p = new URLSearchParams();
    if (next === "admin") p.set("tab", "admin");
    setSearchParams(p, { replace: true });
  }

  async function onClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      notifyError("Enter your email.");
      return;
    }
    if (!password) {
      notifyError("Enter your password.");
      return;
    }
    setClientBusy(true);
    try {
      const r = await clientLogin(email.trim(), password);
      localStorage.setItem(TOKEN_KEY, r.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setClientBusy(false);
    }
  }

  async function onClientForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!clientForgotEmail.includes("@")) {
      notifyError("Enter your email.");
      return;
    }
    setClientForgotBusy(true);
    try {
      await requestClientPasswordReset(clientForgotEmail.trim());
      notifyInfo("If that email has an account, we sent a reset link. Check your inbox.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send email.";
      if (/Email is not configured|admin to create/i.test(msg)) notifyWarning(msg);
      else notifyError(msg);
    } finally {
      setClientForgotBusy(false);
    }
  }

  async function onClientResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 8) {
      notifyError("Use at least 8 characters.");
      return;
    }
    if (newPass !== newPass2) {
      notifyError("Passwords do not match.");
      return;
    }
    setResetBusy(true);
    try {
      await completeClientPasswordReset(clientResetToken, newPass);
      navigate("/login", { replace: true, state: { resetDone: true } });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setResetBusy(false);
    }
  }

  async function onAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = adminUser.trim();
    if (!u) {
      notifyError("Enter your username.");
      return;
    }
    if (!adminPassword) {
      notifyError("Enter your password.");
      return;
    }
    setAdminBusy(true);
    try {
      const key = await loginAdmin(u, adminPassword);
      await fetchAdminSummary(key);
      sessionStorage.setItem(ADMIN_SESSION_KEY, key);
      sessionStorage.removeItem("cpai_admin_key");
      setAdminPassword("");
      navigate("/admin", { replace: true });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Log in | Circle Prospecting AI"
        description="Client dashboard or admin sign-in."
        path="/login"
        noindex
      />
      <div className="app-shell rz-shell rz-app">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="page-space page-space--tight rzInterior">
          <div className="container page-narrow login-page-shell" style={{ maxWidth: 520 }}>
            <header className="page-hero">
              <p className="page-breadcrumb">
                <Link to="/">Home</Link> / Log in
              </p>
              <h1 className="page-h1">Log in</h1>
            </header>

            <div className="login-tab-bar" role="tablist" aria-label="Login type">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "client"}
                className={`login-tab${tab === "client" ? " is-active" : ""}`}
                onClick={() => setTab("client")}
              >
                Client
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "admin"}
                className={`login-tab${tab === "admin" ? " is-active" : ""}`}
                onClick={() => setTab("admin")}
              >
                Admin
              </button>
            </div>

            {tab === "client" && (
              <div role="tabpanel" aria-label="Client login">
                {clientResetToken ? (
                  <form
                    onSubmit={onClientResetSubmit}
                    className="section-surface"
                    style={{ padding: "1.25rem", display: "grid", gap: "1rem", marginTop: "0.75rem" }}
                  >
                    <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
                      Choose a new password for your dashboard account.
                    </p>
                    <label className="cp-form-grid">
                      <span className="muted-label">New password</span>
                      <input
                        type="password"
                        className="premium-input"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                    <label className="cp-form-grid">
                      <span className="muted-label">Confirm password</span>
                      <input
                        type="password"
                        className="premium-input"
                        value={newPass2}
                        onChange={(e) => setNewPass2(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={resetBusy}>
                      {resetBusy ? "Saving…" : "Save new password"}
                    </button>
                    <Link to="/login" className="link-btn" style={{ width: "fit-content" }}>
                      Cancel — back to sign in
                    </Link>
                  </form>
                ) : (
                  <div
                    className="section-surface"
                    style={{ padding: "1.25rem", display: "grid", gap: "1rem", marginTop: "0.75rem" }}
                  >
                    <form onSubmit={onClientSubmit} style={{ display: "grid", gap: "1rem" }}>
                      <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
                        Use the email and password you created on the thank-you page right after you paid.
                      </p>
                      <label className="cp-form-grid">
                        <span className="muted-label">Email</span>
                        <input
                          type="email"
                          className="premium-input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                      </label>
                      <label className="cp-form-grid">
                        <span className="muted-label">Password</span>
                        <input
                          type="password"
                          className="premium-input"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Your password"
                          autoComplete="current-password"
                        />
                      </label>
                      <button type="submit" className="btn btn-primary" disabled={clientBusy}>
                        {clientBusy ? "Signing in…" : "Open my dashboard"}
                      </button>
                    </form>
                    <button
                      type="button"
                      className="link-btn"
                      style={{ width: "fit-content", textAlign: "left" }}
                      onClick={() => {
                        setShowClientForgot((v) => !v);
                      }}
                    >
                      {showClientForgot ? "Hide forgot password" : "Forgot password?"}
                    </button>
                    {showClientForgot ? (
                      <form
                        onSubmit={onClientForgot}
                        className="section-surface"
                        style={{ padding: "1rem", display: "grid", gap: "0.75rem", background: "rgba(15,23,42,0.03)" }}
                      >
                        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                          We email a one-time link when delivery is enabled. Otherwise, ask your admin for a reset link from
                          the dashboard.
                        </p>
                        <input
                          type="email"
                          className="premium-input"
                          placeholder="Your account email"
                          value={clientForgotEmail}
                          onChange={(e) => setClientForgotEmail(e.target.value)}
                          disabled={clientForgotBusy}
                        />
                        <button type="submit" className="btn btn-ghost" disabled={clientForgotBusy}>
                          {clientForgotBusy ? "Sending…" : "Send reset link"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                )}
                {!clientResetToken ? (
                  <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem", fontSize: "0.92rem" }}>
                    <Link to="/dashboard" className="link-btn" style={{ width: "fit-content" }}>
                      Already signed in — open dashboard
                    </Link>
                    <Link to="/buy-leads" className="link-btn" style={{ width: "fit-content" }}>
                      Start prospecting
                    </Link>
                  </div>
                ) : null}
              </div>
            )}

            {tab === "admin" && (
              <div role="tabpanel" aria-label="Admin login">
                {adminBoot ? (
                  <p className="muted" style={{ marginTop: "1rem" }}>
                    Checking session…
                  </p>
                ) : (
                  <div
                    className="section-surface"
                    style={{ padding: "1.25rem", display: "grid", gap: "1rem", marginTop: "0.75rem" }}
                  >
                    <form onSubmit={onAdminSubmit} style={{ display: "grid", gap: "1rem" }}>
                      <label className="cp-form-grid">
                        <span className="muted-label">Username</span>
                        <input
                          type="text"
                          className="premium-input"
                          autoComplete="username"
                          value={adminUser}
                          onChange={(e) => setAdminUser(e.target.value)}
                          placeholder="admin"
                          disabled={adminBusy}
                        />
                      </label>
                      <label className="cp-form-grid">
                        <span className="muted-label">Password</span>
                        <input
                          type="password"
                          className="premium-input"
                          autoComplete="current-password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={adminBusy}
                        />
                      </label>
                      <p
                        className="muted"
                        style={{
                          margin: 0,
                          fontSize: "0.8rem",
                          lineHeight: 1.5,
                          padding: "0.65rem 0.85rem",
                          borderRadius: 12,
                          background: "rgba(15, 23, 42, 0.04)",
                          border: "1px solid rgba(15, 23, 42, 0.08)",
                        }}
                      >
                        <strong style={{ color: "var(--text, #0f172a)" }}>Demo / test:</strong> username{" "}
                        <code className="cp-kbd">admin</code> · password <code className="cp-kbd">changeme</code>
                        <span style={{ display: "block", marginTop: "0.35rem", fontSize: "0.76rem", opacity: 0.9 }}>
                          Default from <code className="cp-kbd">.env</code> — set a strong password on the server for production.
                          After signing in, use <strong>Admin → Account</strong> to rotate it.
                        </span>
                      </p>
                      <button type="submit" className="btn btn-primary" disabled={adminBusy}>
                        {adminBusy ? "Signing in…" : "Open admin dashboard"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <SiteFooter />
      </div>
      <style>{`
        .login-tab-bar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .login-tab {
          text-align: center;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 2px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--muted);
          transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }
        .login-tab:hover {
          border-color: rgba(0, 122, 255, 0.35);
          color: var(--text);
        }
        .login-tab.is-active {
          border-color: rgba(0, 122, 255, 0.55);
          color: var(--cp-blue, #007aff);
          box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.12);
        }
        .login-page-shell {
          box-sizing: border-box;
          padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
          width: 100%;
        }
        @media (max-width: 480px) {
          .login-page-shell .page-h1 {
            font-size: clamp(1.35rem, 6vw, 1.75rem);
          }
          .login-tab {
            padding: 0.65rem 0.5rem;
            font-size: 0.88rem;
          }
        }
      `}</style>
    </>
  );
}
