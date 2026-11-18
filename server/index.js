import 'dotenv/config';
import { getDefaultDbPath, initDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

// Validação de segurança em produção
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET || '';
  if (
    !jwtSecret ||
    jwtSecret === 'tga_winners_dev_jwt_secret_change_me' ||
    jwtSecret === 'dev_secret_change_in_production' ||
    jwtSecret.length < 16
  ) {
    console.warn(
      '⚠️  [SEGURANÇA] JWT_SECRET está ausente, fraco ou com valor padrão em produção! Configure uma chave longa e aleatória no .env.'
    );
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') {
    console.warn(
      '⚠️  [SEGURANÇA] ADMIN_PASSWORD está usando a senha padrão! Altere no .env em produção.'
    );
  }
}

const dbPath = getDefaultDbPath();
const db = initDatabase(dbPath);
const editionsCount = db.prepare('SELECT COUNT(*) AS cnt FROM editions').get().cnt;
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TGA Winners rodando na porta ${PORT} | DB: ${dbPath} (${editionsCount} edições)`);
});
