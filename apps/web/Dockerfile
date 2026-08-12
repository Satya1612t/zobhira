FROM node:20-alpine AS deps
WORKDIR /app
# Plain node:20-alpine has no `openssl` package at all, which makes Prisma's
# own OpenSSL-version detection fail silently and fall back to assuming
# OpenSSL 1.1 — wrong on this Alpine version (ships OpenSSL 3.x only) —
# regardless of what binaryTargets lists in schema.prisma. This is Prisma's
# own documented fix for Alpine images: https://pris.ly/d/alpine
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
# `npm ci` triggers the `postinstall: prisma generate` script (see
# package.json), which needs prisma/schema.prisma present to find — it
# never connects to a database, so a syntactically valid placeholder
# DATABASE_URL is enough here.
COPY prisma ./prisma
# Scoped to this one command, not a persistent ENV — a Dockerfile ENV stays
# set for every later RUN in the same stage, which would leak this
# placeholder into `next build` below and let webpack inline it as a
# literal string into the compiled server chunks, permanently overriding
# the real DATABASE_URL docker-compose sets at container start.
RUN DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" npm ci

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" npx prisma generate
# NEXT_PUBLIC_* Firebase config is inlined into the client bundle at build time
# (not read at runtime), so it must arrive as build args — same as apps/admin's
# Dockerfile. Passed from docker-compose.prod.yml's web build.args.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
# Needed again here — Prisma also re-detects OpenSSL at container startup,
# not just at `generate` time, to pick which bundled engine binary to load.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Next.js "standalone" output deliberately excludes public/ — it only
# traces actual JS import dependencies, and static assets referenced by
# plain <img src="..."> URLs aren't traced. Without this, every logo/icon
# 404s in production despite working fine in dev.
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
# fast-geoip loads its IP→country data files at runtime via fs (not a JS
# import), so Next's standalone file-tracing doesn't include them — the
# package's JS is traced but its data/ dir is not. Copy it in explicitly, or
# the country lookup in /api/track throws and every country comes back null.
COPY --from=build /app/node_modules/fast-geoip/data ./node_modules/fast-geoip/data
EXPOSE 3000
CMD ["node", "server.js"]
