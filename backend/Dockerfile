FROM node:22-alpine AS base
WORKDIR /app

# --- DEPENDENCIAS (producción) ---
FROM base AS deps
COPY package*.json ./
RUN npm ci

# --- BUILD (compila TypeScript) ---
FROM deps AS builder
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npm run prisma:generate
# tsc genera declaration + declarationMap + sourceMap a la vez, lo que le
# hace pedir más heap del que Node asigna por defecto en contenedores con
# poca RAM — sin esto, el build puede morir con "JavaScript heap out of
# memory" en máquinas/CI con memoria ajustada.
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# --- IMAGEN FINAL (producción) ---
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3000
# Producción usa node, no tsx. El comentario va en su propia línea: al final
# de la del CMD, BuildKit (buildx, desde el 2026-11-06) no la lee como JSON y
# la convierte en `/bin/sh -c '["node", …]'`, que no arranca.
CMD ["node", "dist/server.js"]

# --- IMAGEN DE DESARROLLO (con tsx) ---
FROM base AS development
ENV NODE_ENV=development
WORKDIR /app

COPY package*.json ./
# Instala TODAS las dependencias (incluyendo devDependencies)
RUN npm ci

# No copiamos dist, porque usaremos el código fuente directamente
COPY . .

EXPOSE 3000
# En desarrollo usamos tsx watch (o simplemente tsx)
CMD ["npx", "tsx", "watch", "src/server.ts"]