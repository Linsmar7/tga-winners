import 'dotenv/config';
import { initDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

initDatabase();
const app = createApp();

app.listen(PORT, () => {
  console.log(`TGA Winners rodando na porta ${PORT}`);
});
