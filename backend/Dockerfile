FROM oven/bun:1-alpine AS install
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS release
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
COPY --from=install /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /app/public/uploads/profiles /app/public/qrcodes \
  && chmod -R 777 /app/public/uploads /app/public/qrcodes

EXPOSE 8481

CMD ["bun", "run", "start"]
