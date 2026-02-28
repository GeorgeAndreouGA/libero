# ===========================
# CLIENT DOCKERFILE (Next.js)
# ===========================

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package*.json ./
# Increase Node memory for SWC compilation and skip optional dependencies that may fail
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm ci --ignore-scripts && npm rebuild
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Build args for NEXT_PUBLIC_ env variables (must be available at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_LOGO_URL=/branding/logo.png
ARG NEXT_PUBLIC_FAVICON_URL=/branding/favicon.ico
ARG NEXT_PUBLIC_SITE_NAME="Libero Tips"
ARG NEXT_PUBLIC_INSTAGRAM_LINK
ARG NEXT_PUBLIC_INSTAGRAM_LINK_EL
ARG NEXT_PUBLIC_TIKTOK_LINK
ARG NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC
ARG NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC_EL
ARG NEXT_PUBLIC_CONTACT_EMAIL

# Set them as ENV so they're available during build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_LOGO_URL=$NEXT_PUBLIC_LOGO_URL
ENV NEXT_PUBLIC_FAVICON_URL=$NEXT_PUBLIC_FAVICON_URL
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME
ENV NEXT_PUBLIC_INSTAGRAM_LINK=$NEXT_PUBLIC_INSTAGRAM_LINK
ENV NEXT_PUBLIC_INSTAGRAM_LINK_EL=$NEXT_PUBLIC_INSTAGRAM_LINK_EL
ENV NEXT_PUBLIC_TIKTOK_LINK=$NEXT_PUBLIC_TIKTOK_LINK
ENV NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC=$NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC
ENV NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC_EL=$NEXT_PUBLIC_TELEGRAM_LINK_PUBLIC_EL
ENV NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL

# Build Next.js application
RUN npx next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install tzdata for timezone support
RUN apk add --no-cache tzdata wget

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
