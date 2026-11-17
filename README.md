# TGA Winners — Bolão The Game Awards

Aplicação web minimalista em dark mode para amigos criarem palpites anuais do *The Game Awards*.

## Stack
- **Frontend:** React 18 + Vite + React Router + Tailwind CSS + Lucide Icons
- **Backend:** Node.js + Express + SQLite (`better-sqlite3`)
- **Deploy:** Container único via Docker / Dokploy (porta `3000`)

## Desenvolvimento Local

```bash
cp .env.example .env
npm install
npm run dev
```

- Frontend (Vite): `http://localhost:5173`
- API (Express): `http://localhost:3000`
- Admin padrão (`.env`): `/admin/login`

## Build e Produção

```bash
npm run build
npm start
```

## Testes

```bash
npm test
```

## Deploy no Dokploy

1. Configure as variáveis de ambiente:
   - `PORT=3000`
   - `DB_PATH=/app/data/database.sqlite`
   - `UPLOAD_DIR=/app/data/uploads`
   - `ADMIN_USER=admin`
   - `ADMIN_PASSWORD=<senha_forte>`
   - `JWT_SECRET=<chave_aleatoria_longa>`
2. Em **Mounts / Volumes**, mapeie o container path `/app/data` para persistir o banco SQLite e imagens enviadas.
