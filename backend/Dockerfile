FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json tsconfig*.json nest-cli.json ./
RUN npm ci

# Copy source and build
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
