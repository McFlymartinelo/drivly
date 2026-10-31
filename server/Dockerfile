# syntax=docker/dockerfile:1

FROM node:24-alpine
WORKDIR /app

COPY server ./server

RUN mkdir -p /data && chown -R node:node /app /data

USER node
ENV PORT=3000 \
    DRIVLY_DB=/data/drivly.sqlite

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server/index.mjs"]
