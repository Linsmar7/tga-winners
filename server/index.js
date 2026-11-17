import 'dotenv/config';
import { getDefaultDbPath, initDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const dbPath = getDefaultDbPath();
const db = initDatabase(dbPath);
const editionsCount = db.prepare('SELECT COUNT(*) AS cnt FROM editions').get().cnt;
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TGA Winners rodando na porta ${PORT} | DB: ${dbPath} (${editionsCount} edições)`);
});
