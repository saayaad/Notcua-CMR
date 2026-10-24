FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 DATABASE_URL=file:/data/noctua.db WHATSAPP_KEY_FILE=/data/whatsapp.key BACKUP_DIR=/data/backups
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm run db:deploy && npm start"]
