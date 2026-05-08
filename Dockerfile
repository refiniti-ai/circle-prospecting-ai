# Express API for Firebase Hosting → Cloud Run (same domain: /api/** rewrites).
# Build: docker build -t circle-prospecting-api .
# Cloud Run: set env APP_PUBLIC_URL, STRIPE_*, DASHBOARD_JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, etc.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
# Omit devDependencies; `tsx` is a production dependency so `npm start` works on Cloud Run buildpacks too.
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
