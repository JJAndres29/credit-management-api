# ─────────────────────────────────────────────────────────────
# Stage 1 — Builder
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# FIX 1: OpenSSL necesario para que Prisma genere los engines en Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# ─────────────────────────────────────────────────────────────
# Stage 2 — Production
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# FIX 1 (producción): el engine de Prisma necesita libssl en runtime también
RUN apk add --no-cache openssl

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/package.json  ./package.json

# FIX 2: corregir propiedad ANTES de cambiar de usuario
# Sin esto, appuser no puede escribir en node_modules/@prisma/engines
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]