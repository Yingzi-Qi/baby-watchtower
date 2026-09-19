FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/docs ./docs
COPY --from=build /app/node_modules ./node_modules
RUN ./node_modules/.bin/playwright install --with-deps chromium
COPY lib ./lib
COPY scripts ./scripts
COPY server ./server
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node","server/index.mjs"]
