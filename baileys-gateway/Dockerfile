FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Create auth_info directory for persistent session keys
RUN mkdir -p auth_info

VOLUME ["/app/auth_info"]

CMD ["npm", "start"]
