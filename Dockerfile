FROM node:24-alpine AS builder

WORKDIR /app

# Instala dependências para compilação nativa do better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Build do frontend React (Vite) e remove devDependencies para enxugar imagem final
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Cria diretório persistente para o SQLite e uploads
RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
