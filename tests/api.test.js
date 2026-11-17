import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initDatabase, getDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { parseTextInput } from '../scripts/fetch-nominees.mjs';

describe('TGA Winners API End-to-End', () => {
  let server;
  let baseUrl;
  let tmpDir;
  let adminCookie;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tga-test-'));
    process.env.DB_PATH = path.join(tmpDir, 'test.sqlite');
    process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASSWORD = 'secret-test-password';
    process.env.JWT_SECRET = 'test-jwt-secret';

    initDatabase(process.env.DB_PATH);
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('autentica admin, cria edições com clonagem, cadastra indicados, vota com trava híbrida e apura ranking', async () => {
    // 1. Admin auth protection
    const unauth = await fetch(`${baseUrl}/api/admin/editions`);
    assert.equal(unauth.status, 401);

    // 2. Admin login
    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret-test-password' }),
    });
    assert.equal(loginRes.status, 200);
    adminCookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 3. Create 2025 edition (past, voting closed)
    const ed2025Res = await fetch(`${baseUrl}/api/admin/editions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        year: 2025,
        voting_start: '2025-11-01T12:00:00.000Z',
        voting_end: '2025-12-10T21:00:00.000Z',
        event_date: '2025-12-10T21:30:00.000Z',
      }),
    });
    assert.equal(ed2025Res.status, 201);
    const { edition: ed2025 } = await ed2025Res.json();

    // Add 2 categories to 2025
    const cat1Res = await fetch(`${baseUrl}/api/admin/editions/${ed2025.id}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'Game of the Year' }),
    });
    assert.equal(cat1Res.status, 201);

    const cat2Res = await fetch(`${baseUrl}/api/admin/editions/${ed2025.id}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'Best Direction' }),
    });
    assert.equal(cat2Res.status, 201);

    // 4. Create 2026 edition (voting open) cloning categories from 2025
    const now = Date.now();
    const ed2026Res = await fetch(`${baseUrl}/api/admin/editions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        year: 2026,
        voting_start: new Date(now - 3600_000).toISOString(),
        voting_end: new Date(now + 3600_000).toISOString(),
        event_date: new Date(now + 7200_000).toISOString(),
        import_previous: true,
      }),
    });
    assert.equal(ed2026Res.status, 201);
    const ed2026Payload = await ed2026Res.json();
    assert.equal(ed2026Payload.imported_categories_count, 2);

    // Check active edition returns 2026 with 2 cloned categories
    const activeRes = await fetch(`${baseUrl}/api/editions/active`);
    const activeData = await activeRes.json();
    assert.equal(activeData.edition.year, 2026);
    assert.equal(activeData.categories.length, 2);

    const gotyCat = activeData.categories[0];
    const dirCat = activeData.categories[1];

    // Add nominees to GOTY and Best Direction
    const nom1 = await (
      await fetch(`${baseUrl}/api/admin/categories/${gotyCat.id}/nominees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'GTA VI', description: 'Rockstar Games' }),
      })
    ).json();
    const nom2 = await (
      await fetch(`${baseUrl}/api/admin/categories/${gotyCat.id}/nominees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Hollow Knight: Silksong', description: 'Team Cherry' }),
      })
    ).json();
    const dirNom1 = await (
      await fetch(`${baseUrl}/api/admin/categories/${dirCat.id}/nominees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Studio A' }),
      })
    ).json();

    // 5. Reject unauthenticated voting
    const unauthVoteRes = await fetch(`${baseUrl}/api/editions/2026/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votes: [] }),
    });
    assert.equal(unauthVoteRes.status, 401);

    // 6. Register users (Linsmar & Amigo) and prevent duplicate username (case-insensitive)
    const reg1Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Linsmar', password: 'mypassword' }),
    });
    assert.equal(reg1Res.status, 201);
    const linsmarCookie = reg1Res.headers.get('set-cookie').split(';')[0];

    const dupUserRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'linsmar', password: 'otherpassword' }),
    });
    assert.equal(dupUserRes.status, 409);

    const reg2Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Amigo', password: 'friendpassword' }),
    });
    assert.equal(reg2Res.status, 201);
    const amigoCookie = reg2Res.headers.get('set-cookie').split(';')[0];

    // Wrong password login rejected
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Linsmar', password: 'wrong' }),
    });
    assert.equal(badLoginRes.status, 401);

    // Valid login works
    const loginUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Linsmar', password: 'mypassword' }),
    });
    assert.equal(loginUserRes.status, 200);
    const linsmarLoginCookie = loginUserRes.headers.get('set-cookie').split(';')[0];

    // Reject voting on closed edition (2025) even when authenticated
    const closedVoteRes = await fetch(`${baseUrl}/api/editions/2025/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: linsmarCookie },
      body: JSON.stringify({ votes: [] }),
    });
    assert.equal(closedVoteRes.status, 403);

    // 7. Linsmar submits votes for 2026
    const vote1Res = await fetch(`${baseUrl}/api/editions/2026/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: linsmarCookie },
      body: JSON.stringify({
        votes: [
          {
            category_id: gotyCat.id,
            will_win_nominee_id: nom1.nominee.id,
            want_win_nominee_id: nom2.nominee.id,
          },
          {
            category_id: dirCat.id,
            will_win_nominee_id: dirNom1.nominee.id,
            want_win_nominee_id: dirNom1.nominee.id,
          },
        ],
      }),
    });
    assert.equal(vote1Res.status, 200);

    // 8. Amigo submits votes for 2026
    const vote2Res = await fetch(`${baseUrl}/api/editions/2026/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: amigoCookie },
      body: JSON.stringify({
        votes: [
          {
            category_id: gotyCat.id,
            will_win_nominee_id: nom1.nominee.id,
            want_win_nominee_id: nom1.nominee.id,
          },
        ],
      }),
    });
    assert.equal(vote2Res.status, 200);

    // 9. Admin marks Silksong as GOTY winner -> Linsmar gets +1 bonus, Amigo gets 0
    const winRes = await fetch(`${baseUrl}/api/admin/categories/${gotyCat.id}/winner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ nominee_id: nom2.nominee.id }),
    });
    assert.equal(winRes.status, 200);

    // Check live ranking
    const rankRes = await fetch(`${baseUrl}/api/editions/2026/ranking`);
    assert.equal(rankRes.status, 200);
    const rankData = await rankRes.json();
    assert.equal(rankData.ranking[0].nickname, 'Linsmar');
    assert.equal(rankData.ranking[0].total_points, 1);
    assert.equal(rankData.ranking[1].nickname, 'Amigo');
    assert.equal(rankData.ranking[1].total_points, 0);

    // 10. Linsmar logs in on another device and edits existing votes (still 1 entry in ranking)
    const myVotesRes = await fetch(`${baseUrl}/api/editions/2026/my-votes`, {
      headers: { Cookie: linsmarLoginCookie },
    });
    assert.equal(myVotesRes.status, 200);
    const myVotesData = await myVotesRes.json();
    assert.equal(myVotesData.user.username, 'Linsmar');
    assert.equal(myVotesData.voter.nickname, 'Linsmar');
    assert.equal(myVotesData.votes.length, 2);

    const editVoteRes = await fetch(`${baseUrl}/api/editions/2026/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: linsmarLoginCookie },
      body: JSON.stringify({
        votes: [
          {
            category_id: gotyCat.id,
            will_win_nominee_id: nom2.nominee.id,
            want_win_nominee_id: nom2.nominee.id,
          },
        ],
      }),
    });
    assert.equal(editVoteRes.status, 200);

    const rankAfterEdit = await (await fetch(`${baseUrl}/api/editions/2026/ranking`)).json();
    assert.equal(rankAfterEdit.ranking.length, 2);
    assert.equal(rankAfterEdit.ranking[0].nickname, 'Linsmar');
    assert.equal(rankAfterEdit.ranking[0].total_points, 5);

    // 11. Image upload & static serving
    const formData = new FormData();
    formData.append('image', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'test.png');
    const uploadRes = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    assert.equal(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.url.startsWith('/uploads/'));

    const staticUploadRes = await fetch(`${baseUrl}${uploadData.url}`);
    assert.equal(staticUploadRes.status, 200);

    // 12. SPA fallback serves built dist/index.html
    const spaRes = await fetch(`${baseUrl}/ranking`);
    assert.equal(spaRes.status, 200);
    const spaHtml = await spaRes.text();
    assert.ok(spaHtml.includes('TGA Winners'));

    // 13. Importador JSON: reaproveita categorias existentes e cria novas + indicados sem duplicar
    const importRes1 = await fetch(`${baseUrl}/api/admin/editions/${ed2025.id}/import-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        schema: 'tga-winners-import/v1',
        year: 2025,
        categories: [
          {
            name: 'Game of the Year', // já existe na edição 2025
            nominees: [
              { name: 'Clair Obscur: Expedition 33', description: 'Sandfall Interactive', image_url: null },
              { name: 'Hades II', description: 'Supergiant Games', image_url: 'https://example.com/hades2.jpg' },
            ],
          },
          {
            name: 'Best Indie Game', // nova categoria
            nominees: [
              { name: 'Blue Prince', description: 'Dogubomb', image_url: 'https://example.com/bp.jpg' },
            ],
          },
        ],
      }),
    });
    assert.equal(importRes1.status, 200);
    const importData1 = await importRes1.json();
    assert.equal(importData1.categories_created, 1);
    assert.equal(importData1.categories_reused, 1);
    assert.equal(importData1.nominees_created, 3);

    // Reimportar com imagem preenchida em Clair Obscur e um novo indicado -> atualiza imagem sem duplicar
    const importRes2 = await fetch(`${baseUrl}/api/admin/editions/${ed2025.id}/import-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        categories: [
          {
            name: 'game of the year', // case-insensitive match
            nominees: [
              { name: 'Clair Obscur: Expedition 33', description: 'Sandfall Interactive', image_url: 'https://example.com/e33.jpg' },
              { name: 'Hades II', description: 'Supergiant Games', image_url: 'https://example.com/hades2.jpg' },
              { name: 'Silksong', description: 'Team Cherry', image_url: 'https://example.com/silksong.jpg' },
            ],
          },
        ],
      }),
    });
    assert.equal(importRes2.status, 200);
    const importData2 = await importRes2.json();
    assert.equal(importData2.categories_created, 0);
    assert.equal(importData2.categories_reused, 1);
    assert.equal(importData2.nominees_created, 1);
    assert.equal(importData2.nominees_updated, 1);
    assert.equal(importData2.nominees_skipped, 1);

    // 14. Parser de texto genérico para o script anual
    const parsedTxt = parseTextInput(
      `# Game of the Year\n- Jogo X | Studio X\n# Best Performance\n- Ator Y | Jogo X [person]\n`,
      2027
    );
    assert.equal(parsedTxt.year, 2027);
    assert.equal(parsedTxt.categories.length, 2);
    assert.equal(parsedTxt.categories[1].nominees[0].kind, 'person');

    // 15. Vinculação automática de palpites legados (user_id NULL) ao registrar mesmo nome
    const db = getDb();
    const nowIso = new Date().toISOString();
    const legacyInfo = db
      .prepare(
        `INSERT INTO voters (edition_id, user_id, nickname, voter_token, created_at, updated_at)
         VALUES (?, NULL, 'LegacyLinsmar', 'legacy-tok-1', ?, ?)`
      )
      .run(activeData.edition.id, nowIso, nowIso);
    db.prepare(
      `INSERT INTO votes (voter_id, category_id, will_win_nominee_id, want_win_nominee_id)
       VALUES (?, ?, ?, ?)`
    ).run(legacyInfo.lastInsertRowid, gotyCat.id, nom2.nominee.id, nom2.nominee.id);

    const legacyRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'LegacyLinsmar', password: 'secret' }),
    });
    assert.equal(legacyRegRes.status, 201);
    const legacyCookie = legacyRegRes.headers.get('set-cookie').split(';')[0];

    const claimedRes = await fetch(`${baseUrl}/api/editions/2026/my-votes`, {
      headers: { Cookie: legacyCookie },
    });
    const claimedData = await claimedRes.json();
    assert.equal(claimedData.voter.nickname, 'LegacyLinsmar');
    assert.equal(claimedData.votes.length, 1);
    assert.equal(claimedData.votes[0].will_win_nominee_id, nom2.nominee.id);
  });
});
