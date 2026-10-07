# The whole app in one image: the backend serves the built frontend.
#   docker build -t myworkschedule .
# Settings come from environment variables; see .env.example and the
# configuration reference.

# --- Build the frontend (PWA) ---
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Runtime: backend + built frontend ---
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3003
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./
COPY --from=frontend /build/dist ./dist

# Don't run as root.
USER node
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

# Runs database migrations, then starts the server (MIGRATE_ON_START).
CMD ["node", "index.js"]
