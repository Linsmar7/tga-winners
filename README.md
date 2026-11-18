# TGA Winners — Bolão The Game Awards

Aplicação web full-stack (dark & gold) para bolões anuais do *The Game Awards* entre amigos.

## Features

### Votação & Experiência do Usuário
- **Voto Duplo por Categoria:** escolha **Vai Ganhar** (`+5 pts` padrão ou peso customizado) e **Quero que Ganhe** (`+1 pt` bônus zebra se vencer sendo diferente do palpite principal).
- **Bingo / Palpites Extras (Side Bets):** perguntas extras da cerimônia com pontuação bônus configurável.
- **Modo Lista & Modo Foco:** votação em lista completa ou carrossel *1 categoria por vez* (com suporte a setas do teclado e swipe no mobile).
- **Ações Rápidas:** duplo-clique para marcar *Vai Ganhar + Quero*, botão *"Igual ao Vai Ganhar"*, **Modo Caos** (preenchimento aleatório das pendentes), busca instantânea e filtros (`Todas`, `Pendentes`, `Completas`, `Parciais`, `Vazias`).
- **Auto-Save & Rascunho Local:** salvamento automático com debounce (`1.5s`), persistência de rascunho em `localStorage`, aviso de alterações não salvas e bloqueio automático em tempo real ao encerrar o prazo.
- **Compartilhamento:** gerador de **Card PNG** (via Canvas) para palpites/resultado final e cópia de resumo formatado para WhatsApp/Discord.
- **PWA & Social:** instalável no celular (`manifest.webmanifest` + Service Worker) e meta tags OpenGraph.

### Ranking, Estatísticas & Tempo Real
- **Apuração Ao Vivo (SSE):** atualização instantânea via *Server-Sent Events* quando o Admin marca vencedores ou extras, com banner ao vivo e efeito de confete ao pontuar.
- **Placar com Empates Reais:** posições com empate real (`#1`, `#1`, `#3`), destaque para o usuário logado e selo `👑` para quem cravou o GOTY.
- **Destaques & Prêmios da Galera:** *Barbada do Ano*, *Zebra do Ano*, *Queridinho da Galera*, *Mais Iludido* (`🤡`), *Oráculo / Mãe Dináh* (`🔮`), *Único Visionário* (`🦄`), *Sonhador* (`💭`), *Pragmático* (`🧠`), *Gêmeos de Palpite* (`👯`) e *Rivais* (`⚔️`).
- **Palpites Abertos & Comparador Head-to-Head:** visualização dos palpites de qualquer participante a qualquer momento e comparação lado a lado (*Você vs. Amigo*) com % de concordância e filtro *"Só divergências"*.
- **Consenso da Galera:** barras percentuais de votos (*Vai Ganhar* vs. *Quero*) por indicado em cada categoria.
- **Gráfico de Evolução:** linha do tempo interativa em SVG mostrando a evolução de pontos e posições a cada categoria apurada (com base inicial em `17/11/2026`).
- **Simulador "E se...?":** simulação interativa dos vencedores das categorias restantes para projetar quem vence o bolão.
- **Hall da Fama (`/historico`):** histórico multi-edição com quadro de campeões por ano e ranking geral acumulado.

### Contas & Painel Admin (`/admin`)
- **Autenticação de Usuários:** cadastro/login com JWT (`httpOnly`), vinculação automática de palpites legados pelo apelido e modal para alterar apelido ou senha.
- **Gestão de Edições & Categorias:** criação de edições, clonagem do ano anterior, pesos de pontuação customizados por categoria e reordenação via *Drag & Drop*.
- **Indicados & Busca Automática de Capas:** upload local de imagens (com limpeza automática de arquivos órfãos), links externos (Steam/Trailer) e busca automática de capas via Steam, Wikipedia e iTunes.
- **Importação, Exportação & Backup:** importação em lote via JSON, script CLI paralelo (`npm run fetch:nominees`), exportação JSON completa da edição e download de backup consistente do `database.sqlite`.
- **Gestão de Participantes:** remoção de palpites por edição e reset de senha de usuários pelo Admin.
- **Performance & Segurança:** code splitting (`React.lazy`), skeleton loading, compressão gzip/brotli, cache HTTP para `/uploads` e `/assets`, headers de segurança e rate limiting nas rotas de autenticação.

---

## Stack
- **Frontend:** React 18 + Vite + React Router + Tailwind CSS + Lucide Icons
- **Backend:** Node.js + Express + SQLite (`better-sqlite3`) + SSE
- **Deploy:** Container único via Docker / Dokploy (porta `3000`, multi-stage build enxuto)

## Comandos

```bash
cp .env.example .env
npm install
npm run dev              # Frontend (5173) + API (3000)
npm test                 # Suite de testes (API E2E + Scoring)
npm run build && npm start
npm run fetch:nominees -- --input scripts/inputs/modelo-anual.txt --year 2026
```

## Deploy (Docker / Dokploy)
Variáveis: `PORT=3000`, `DB_PATH=/app/data/database.sqlite`, `UPLOAD_DIR=/app/data/uploads`, `ADMIN_USER`, `ADMIN_PASSWORD`, `JWT_SECRET`. Mapeie o volume `/app/data` para persistir o banco SQLite e uploads.
