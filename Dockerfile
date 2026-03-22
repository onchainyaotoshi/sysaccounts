# Stage 1: Build React frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci
COPY client/ ./client/
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine
RUN apk add --no-cache sudo shadow util-linux
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=9995
ENV HOST=0.0.0.0
EXPOSE 9995

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server/index.js"]
