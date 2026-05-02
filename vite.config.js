import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiPort = env.API_PORT || "8787";
    const target = `http://127.0.0.1:${apiPort}`;
    return {
        plugins: [
            react(),
            {
                name: "security-headers",
                configureServer(server) {
                    server.middlewares.use((_req, res, next) => {
                        res.setHeader("X-Content-Type-Options", "nosniff");
                        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
                        res.setHeader("X-Frame-Options", "DENY");
                        res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
                        next();
                    });
                },
            },
        ],
        server: {
            proxy: {
                "/api": { target, changeOrigin: true },
            },
        },
        // Same as dev: lets `vite preview` reach the local API without baking VITE_API_BASE_URL.
        preview: {
            proxy: {
                "/api": { target, changeOrigin: true },
            },
        },
    };
});
