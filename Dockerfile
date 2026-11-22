# syntax=docker/dockerfile:1
# Lines & Logos Business OS — all-in-one image.
#   docker build -t lines-logos .
#   docker run -d -p 3001:3001 -v lines-logos-data:/app/data --name lines-logos lines-logos
# First person to open http://localhost:3001/login.html creates the owner account.
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app

# zero-dependency server — nothing to npm-install; .dockerignore keeps secrets and dev artifacts out
COPY package.json server.js ./
COPY assets ./assets
COPY lib ./lib
COPY icons ./icons
COPY .well-known ./.well-known
COPY *.html ./
COPY *.png ./
COPY *.webmanifest sw.js sitemap.xml robots.txt ./

RUN addgroup -S lines && adduser -S lines -G lines \
 && mkdir -p /app/data/backups /app/data/uploads \
 && chown -R lines:lines /app
USER lines

EXPOSE 3001
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
