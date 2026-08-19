FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY migrations ./migrations

CMD ["npm", "run", "migrate:up"]
