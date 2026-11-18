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
    process.env.DISABLE_RATE_LIMIT = '1';

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

  it('cobre fluxo completo: auth, pesos, side bets, comparador, histórico, evolução, backup e segurança', async () => {
    // 0. Security headers check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('x-powered-by'), null);

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

    // 3. Create 2025 edition (past, voting closed) with weighted GOTY (10 pts)
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

    const cat1Res = await fetch(`${baseUrl}/api/admin/editions/${ed2025.id}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'Game of the Year', points_weight: 10 }),
    });
    assert.equal(cat1Res.status, 201);

    const cat2Res = await fetch(`${baseUrl}/api/admin/editions/${ed2025.id}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'Best Direction', points_weight: 5 }),
    });
    assert.equal(cat2Res.status, 201);

    // 4. Create 2026 edition (voting open) cloning categories + weights from 2025
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

    const activeRes = await fetch(`${baseUrl}/api/editions/active`);
    const activeData = await activeRes.json();
    assert.equal(activeData.edition.year, 2026);
    assert.equal(activeData.categories.length, 2);
    assert.equal(activeData.categories[0].points_weight, 10);
    assert.ok(Array.isArray(activeData.editions));

    const gotyCat = activeData.categories[0];
    const dirCat = activeData.categories[1];

    // Add nominees with external_url
    const nom1 = await (
      await fetch(`${baseUrl}/api/admin/categories/${gotyCat.id}/nominees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'GTA VI',
          description: 'Rockstar Games',
          external_url: 'https://www.rockstargames.com/VI',
        }),
      })
    ).json();
    assert.equal(nom1.nominee.external_url, 'https://www.rockstargames.com/VI');

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

    // Add Side Bet (Bingo)
    const sbRes = await fetch(`${baseUrl}/api/admin/editions/${activeData.edition.id}/side-bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        question: 'Half-Life 3 vai aparecer?',
        options: ['Sim', 'Não'],
        points: 3,
      }),
    });
    assert.equal(sbRes.status, 201);
    const { side_bet: sideBet1 } = await sbRes.json();

    // 5. Reject unauthenticated voting
    const unauthVoteRes = await fetch(`${baseUrl}/api/editions/2026/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votes: [] }),
    });
    assert.equal(unauthVoteRes.status, 401);

    // 6. Register users (Linsmar & Amigo)
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
    const { user: amigoUser } = await reg2Res.json();
    const amigoCookie = reg2Res.headers.get('set-cookie').split(';')[0];

    // User self-service password change
    const chPassRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: linsmarCookie },
      body: JSON.stringify({ current_password: 'mypassword', new_password: 'newpassword123' }),
    });
    assert.equal(chPassRes.status, 200);

    // Admin resets Amigo password
    const resetRes = await fetch(`${baseUrl}/api/admin/users/${amigoUser.id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ new_password: 'resetedpass' }),
    });
    assert.equal(resetRes.status, 200);

    const amigoNewLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Amigo', password: 'resetedpass' }),
    });
    assert.equal(amigoNewLogin.status, 200);

    // 7. Linsmar and Amigo submit votes + side bets
    const vote1Res = await fetch(`${baseUrl}/api/editions/2026/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: linsmarCookie },
      body: JSON.stringify({
        votes: [
          {
            category_id: gotyCat.id,
            will_win_nominee_id: nom2.nominee.id,
            want_win_nominee_id: nom2.nominee.id,
          },
          {
            category_id: dirCat.id,
            will_win_nominee_id: dirNom1.nominee.id,
            want_win_nominee_id: dirNom1.nominee.id,
          },
        ],
        side_bet_votes: [{ side_bet_id: sideBet1.id, selected_option: 'Não' }],
      }),
    });
    assert.equal(vote1Res.status, 200);
    const vote1Data = await vote1Res.json();

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
        side_bet_votes: [{ side_bet_id: sideBet1.id, selected_option: 'Sim' }],
      }),
    });
    assert.equal(vote2Res.status, 200);
    const vote2Data = await vote2Res.json();

    // 8. Palpites de outros participantes SEMPRE visíveis mesmo com votação aberta!
    const peekRes = await fetch(`${baseUrl}/api/editions/2026/voters/${vote1Data.voter.id}`);
    assert.equal(peekRes.status, 200);
    const peekData = await peekRes.json();
    assert.equal(peekData.voter.nickname, 'Linsmar');
    assert.equal(peekData.side_bets.length, 1);

    // 9. Head-to-Head compare & simulation data
    const cmpRes = await fetch(
      `${baseUrl}/api/editions/2026/compare?a=${vote1Data.voter.id}&b=${vote2Data.voter.id}`
    );
    assert.equal(cmpRes.status, 200);
    const cmpData = await cmpRes.json();
    assert.equal(cmpData.summary.agreement_will_pct, 0);

    const simRes = await fetch(`${baseUrl}/api/editions/2026/simulation-data`);
    assert.equal(simRes.status, 200);
    const simData = await simRes.json();
    assert.equal(simData.voters.length, 2);

    // 10. Admin marks Silksong as GOTY winner (+10 pts) and Side Bet answer ("Não", +3 pts)
    const winRes = await fetch(`${baseUrl}/api/admin/categories/${gotyCat.id}/winner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ nominee_id: nom2.nominee.id }),
    });
    assert.equal(winRes.status, 200);

    const sbAnsRes = await fetch(`${baseUrl}/api/admin/side-bets/${sideBet1.id}/answer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ correct_option: 'Não' }),
    });
    assert.equal(sbAnsRes.status, 200);

    // Check live ranking with weights + side bets + evolution timeline
    const rankRes = await fetch(`${baseUrl}/api/editions/2026/ranking`);
    assert.equal(rankRes.status, 200);
    const rankData = await rankRes.json();
    assert.equal(rankData.ranking[0].nickname, 'Linsmar');
    assert.equal(rankData.ranking[0].total_points, 13); // 10 GOTY + 3 side bet
    assert.equal(rankData.ranking[0].hit_goty, true);
    assert.equal(rankData.evolution.steps.length, 3); // Start (17/11/2026) + GOTY + SideBet

    // 11. History / Hall da Fama
    const histRes = await fetch(`${baseUrl}/api/history`);
    assert.equal(histRes.status, 200);
    const histData = await histRes.json();
    assert.equal(histData.leaderboard[0].nickname, 'Linsmar');
    assert.equal(histData.leaderboard[0].titles, 1);

    // 12. Image upload, static serving & orphan cleanup on delete
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      'test.png'
    );
    const uploadRes = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    assert.equal(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.url.startsWith('/uploads/'));

    const tempNomRes = await fetch(`${baseUrl}/api/admin/categories/${dirCat.id}/nominees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'Temp Nominee', image_url: uploadData.url }),
    });
    const tempNom = await tempNomRes.json();
    const uploadedDiskPath = path.join(process.env.UPLOAD_DIR, path.basename(uploadData.url));
    assert.equal(fs.existsSync(uploadedDiskPath), true);

    await fetch(`${baseUrl}/api/admin/nominees/${tempNom.nominee.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(fs.existsSync(uploadedDiskPath), false);

    // 13. Backup SQLite & Export JSON
    const backupRes = await fetch(`${baseUrl}/api/admin/backup/db`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(backupRes.status, 200);
    const backupBuf = Buffer.from(await backupRes.arrayBuffer());
    assert.ok(backupBuf.subarray(0, 15).toString('utf8').startsWith('SQLite format 3'));

    const exportRes = await fetch(`${baseUrl}/api/admin/editions/${activeData.edition.id}/export`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(exportRes.status, 200);
    const exportData = await exportRes.json();
    assert.equal(exportData.schema, 'tga-winners-export/v1');
    assert.equal(exportData.side_bets.length, 1);

    // 14. Importador JSON & parser de texto
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
  });
});
