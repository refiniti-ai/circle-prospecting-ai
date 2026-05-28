import { initGoogleMapsAuthFailureHook } from "./lib/googleMapsAuth";
initGoogleMapsAuthFailureHook();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import "./styles/premium-pages.css";
import "./pages/home.css";
import "./styles/rezora-shell.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
