# LinkStash — self-hostable Docker image.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
# OpenSSL is required by the Prisma query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies. postinstall copies the pdf.js worker and generates
# the Prisma client for this (Linux) platform.
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Build the app. (.dockerignore keeps the host's generated client and
# node_modules out, so the Linux client generated above is preserved.)
COPY . .
RUN npm run build

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Persist the SQLite database and uploaded files via volumes.
VOLUME ["/app/prisma", "/app/uploads"]

# Apply migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
