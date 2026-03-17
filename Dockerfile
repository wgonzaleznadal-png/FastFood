# Prisma 7.4 requires Node 20.19+, 22.12+, or 24.0+
FROM node:20.19-alpine AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/prisma.config.ts ./
COPY backend/prisma ./prisma/
# Dummy DATABASE_URL for generate (doesn't connect); real URL at runtime for migrate
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src/
RUN npm run build

# Production image
FROM node:20.19-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma ./prisma/

ENV NODE_ENV=production

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
