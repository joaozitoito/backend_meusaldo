# Base: Node 24 LTS + openssl, que o Prisma exige na imagem slim.
FROM node:24.22.3-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV HOST=0.0.0.0
COPY package*.json ./
COPY prisma ./prisma

# dev: tsx watch com o código montado pelo compose; aplica migrações ao subir.
FROM base AS dev
RUN npm ci && npx prisma generate
COPY . .
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]

# build: compila TypeScript. Também roda as migrações no compose de produção.
FROM base AS build
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build

# prod: só dependências de produção, JS compilado e client Prisma gerado, sem root.
FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
