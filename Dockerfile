# ─────────────────────────────────────────────────────────────
# Stage 1 — Builder
# Instala dependencias, genera Prisma Client y compila TypeScript.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos primero para aprovechar la caché de capas de Docker.
# Si package.json / package-lock.json no cambian, npm ci no re-descarga nada.
COPY package.json package-lock.json ./

# --omit=dev para CI (las devDeps se necesitan solo para compilar)
# npm ci garantiza instalación reproducible desde el lockfile
RUN npm ci

# Copiar el schema de Prisma antes de generate
COPY prisma ./prisma

# Genera el Prisma Client adaptado al runtime de Alpine (linux-musl)
RUN npx prisma generate

# Copiar el resto del código fuente y compilar
COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# ─────────────────────────────────────────────────────────────
# Stage 2 — Production
# Imagen mínima: solo lo necesario para ejecutar la app.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Ejecutar como usuario no-root (buena práctica de seguridad)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar solo los artefactos necesarios desde el builder
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/package.json  ./package.json

# Cambiar a usuario no-root
USER appuser

# Puerto expuesto (documentación; el puerto real lo define PORT en .env / compose)
EXPOSE 3000

# Healthcheck nativo de Docker — coincide con GET /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# 1. Aplica migraciones pendientes (seguro en producción: no crea ni modifica sin migración)
# 2. Arranca la app compilada
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
