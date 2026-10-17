# --- 1) Compilar el frontend ---
FROM node:20-slim AS front
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
RUN npm run build

# --- 2) Backend + frontend compilado, todo en un solo servicio ---
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/ ./
RUN npm run build
COPY --from=front /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
EXPOSE 3000
# Aplica las migraciones a la base de datos y arranca
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
