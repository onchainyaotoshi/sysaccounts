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
ENV PORT=9998
ENV HOST=0.0.0.0
EXPOSE 9998

CMD ["node", "server/index.js"]
