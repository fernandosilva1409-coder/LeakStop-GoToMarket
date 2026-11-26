# syntax=docker/dockerfile:1

# ── deps ─────────────────────────────────────────────────────────────────────
# Install production + build dependencies against the committed lockfile.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
# Build the Next.js app. output:"standalone" emits a self-contained server
# under .next/standalone. NEXT_PUBLIC_* values are inlined into the client
# bundle at build time, so they must be present here as build args (see fly.toml
# [build.args] and the deploy guide) — the server-only secrets are injected at
# runtime via Fly secrets, never baked into the image.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
# Minimal runtime image: just the standalone server, static assets and public/.
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# server.js is produced by output:"standalone".
CMD ["node", "server.js"]
