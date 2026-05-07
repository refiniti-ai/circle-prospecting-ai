# Express API for Firebase Hosting → Cloud Run (same domain: /api/** rewrites).
# Build: docker build -t circle-prospecting-api .
# Cloud Run: set env APP_PUBLIC_URL, STRIPE_*, DASHBOARD_JWT_SECRET, ADMIN_API_KEY, etc.
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
