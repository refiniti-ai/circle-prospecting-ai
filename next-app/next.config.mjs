/** @type {import('next').NextConfig} */

/**
 * When set (e.g. http://127.0.0.1:8787), browser calls to /api/* are proxied to the existing Express app.
 * In development, defaults to the repo's API (see root `npm run dev:api`) so CORS is not required.
 */
const apiProxyTarget =
  process.env.API_PROXY_TARGET?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8787" : "");

const nextConfig = {
  async rewrites() {
    const base = apiProxyTarget.replace(/\/$/, "");
    if (!base) return [];
    return [{ source: "/api/:path*", destination: `${base}/api/:path*` }];
  },
};

export default nextConfig;
