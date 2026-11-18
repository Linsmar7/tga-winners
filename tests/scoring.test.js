import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRankingAndStats, buildVoterDetails, buildHeadToHead } from '../server/scoring.js';
import { LEGACY_BASELINE_DATE } from '../server/db.js';

describe('computeRankingAndStats', () => {
  const categories = [
    { id: 1, name: 'Game of the Year', display_order: 1, points_weight: 5 },
    { id: 2, name: 'Best Direction', display_order: 2, points_weight: 5 },
    { id: 3, name: 'Best Indie', display_order: 3, points_weight: 5 },
  ];

  const nominees = [
    { id: 10, category_id: 1, name: 'Game A', image_url: 'https://img/a.jpg', is_winner: true, decided_at: '2026-12-10T22:00:00.000Z' },
    { id: 11, category_id: 1, name: 'Game B', image_url: null, is_winner: false },
    { id: 20, category_id: 2, name: 'Dir A', image_url: null, is_winner: false },
    { id: 21, category_id: 2, name: 'Dir B', image_url: null, is_winner: true, decided_at: '2026-12-10T22:05:00.000Z' },
    { id: 30, category_id: 3, name: 'Indie A', image_url: null, is_winner: true, decided_at: '2026-12-10T22:10:00.000Z' },
    { id: 31, category_id: 3, name: 'Indie B', image_url: null, is_winner: false },
  ];

  it('aplica +5 por Vai Ganhar e +1 bônus zebra apenas quando diferente do palpite principal', () => {
    const voters = [
      { id: 1, nickname: 'Alice' },
      { id: 2, nickname: 'Bob' },
      { id: 3, nickname: 'Carol' },
    ];

    const votes = [
      { voter_id: 1, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
      { voter_id: 1, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 21 },
      { voter_id: 1, category_id: 3, will_win_nominee_id: 31, want_win_nominee_id: 31 },
      { voter_id: 2, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 11 },
      { voter_id: 2, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 20 },
      { voter_id: 3, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 11 },
      { voter_id: 3, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 20 },
      { voter_id: 3, category_id: 3, will_win_nominee_id: 30, want_win_nominee_id: 31 },
    ];

    const result = computeRankingAndStats({ categories, nominees, voters, votes });

    assert.equal(result.ranking[0].nickname, 'Carol');
    assert.equal(result.ranking[0].total_points, 10);
    assert.equal(result.ranking[0].will_win_hits, 2);
    assert.equal(result.ranking[0].hit_goty, true);

    assert.equal(result.ranking[1].nickname, 'Alice');
    assert.equal(result.ranking[1].total_points, 6);
    assert.equal(result.ranking[1].will_win_hits, 1);
    assert.equal(result.ranking[1].want_win_bonus_hits, 1);

    assert.equal(result.ranking[2].nickname, 'Bob');
    assert.equal(result.ranking[2].total_points, 5);

    assert.equal(result.stats.barbada.category_name, 'Game of the Year');
    assert.equal(result.stats.barbada.percentage, 100);
    assert.equal(result.stats.barbada.winner_image_url, 'https://img/a.jpg');

    assert.equal(result.stats.zebra.category_name, 'Best Direction');
    assert.equal(result.stats.zebra.percentage, 0);

    assert.equal(result.stats.queridinho.votes_count, 2);
    assert.equal(result.stats.mais_iludido.nickname, 'Carol');
    assert.equal(result.stats.mais_iludido.lost_want_win_count, 3);

    // Único Visionário: Carol foi a única a acertar Indie A entre 2 votantes em Best Indie
    assert.equal(result.stats.unique_visionaries.length, 1);
    assert.equal(result.stats.unique_visionaries[0].nickname, 'Carol');

    // Consenso e linha do tempo de evolução (início 17/11/2026 + 3 eventos)
    assert.equal(result.consensus.length, 3);
    assert.equal(result.evolution.steps.length, 4);
    assert.equal(result.evolution.steps[0].timestamp, LEGACY_BASELINE_DATE);
    assert.equal(result.evolution.steps[3].standings[3].points, 10);
  });

  it('atribui empates reais (#1, #1, #3), suporta peso customizado e palpites extras (side bets)', () => {
    const weightedCats = [
      { id: 1, name: 'Game of the Year', display_order: 1, points_weight: 10 },
    ];
    const noms = [
      { id: 10, category_id: 1, name: 'GTA VI', is_winner: true },
      { id: 11, category_id: 1, name: 'Silksong', is_winner: false },
    ];
    const sideBets = [
      { id: 100, question: 'HL3 aparece?', options: ['Sim', 'Não'], points: 3, correct_option: 'Não', display_order: 1 },
    ];
    const voters = [
      { id: 1, nickname: 'Bruno' },
      { id: 2, nickname: 'Ana' },
      { id: 3, nickname: 'Carlos' },
    ];
    const votes = [
      { voter_id: 1, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
      { voter_id: 2, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
      { voter_id: 3, category_id: 1, will_win_nominee_id: 11, want_win_nominee_id: 11 },
    ];
    const sideBetVotes = [
      { voter_id: 1, side_bet_id: 100, selected_option: 'Não' },
      { voter_id: 2, side_bet_id: 100, selected_option: 'Não' },
      { voter_id: 3, side_bet_id: 100, selected_option: 'Sim' },
    ];

    const res = computeRankingAndStats({
      categories: weightedCats,
      nominees: noms,
      voters,
      votes,
      sideBets,
      sideBetVotes,
    });

    assert.equal(res.ranking[0].nickname, 'Ana');
    assert.equal(res.ranking[0].position, 1);
    assert.equal(res.ranking[0].total_points, 13); // 10 GOTY + 3 side bet
    assert.equal(res.ranking[1].nickname, 'Bruno');
    assert.equal(res.ranking[1].position, 1); // empate real!
    assert.equal(res.ranking[1].total_points, 13);
    assert.equal(res.ranking[2].nickname, 'Carlos');
    assert.equal(res.ranking[2].position, 3); // pula para #3!
    assert.equal(res.ranking[2].total_points, 0);
  });

  it('usa maior número de acertos em Vai Ganhar como desempate', () => {
    const voters = [
      { id: 1, nickname: 'ZebraMaster' },
      { id: 2, nickname: 'MainPicker' },
    ];
    const cats = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `Cat ${i + 1}`,
      display_order: i + 1,
      points_weight: 5,
    }));
    const noms = cats.flatMap((c) => [
      { id: c.id * 10 + 1, category_id: c.id, name: `Win ${c.id}`, is_winner: true },
      { id: c.id * 10 + 2, category_id: c.id, name: `Lose ${c.id}`, is_winner: false },
    ]);
    const tieVotes = [
      ...[1, 2, 3, 4, 5].map((cid) => ({
        voter_id: 1,
        category_id: cid,
        will_win_nominee_id: cid * 10 + 2,
        want_win_nominee_id: cid * 10 + 1,
      })),
      {
        voter_id: 2,
        category_id: 1,
        will_win_nominee_id: 11,
        want_win_nominee_id: 11,
      },
    ];

    const res = computeRankingAndStats({
      categories: cats,
      nominees: noms,
      voters,
      votes: tieVotes,
    });
    assert.equal(res.ranking[0].nickname, 'MainPicker');
    assert.equal(res.ranking[0].position, 1);
    assert.equal(res.ranking[1].nickname, 'ZebraMaster');
    assert.equal(res.ranking[1].position, 2);
  });

  it('monta detalhes do participante e comparador Head-to-Head corretamente', () => {
    const details = buildVoterDetails({
      voter: { id: 1, nickname: 'Linsmar' },
      categories,
      nominees,
      votes: [
        { voter_id: 1, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
        { voter_id: 1, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 21 },
      ],
    });
    assert.equal(details.voter.total_points, 6);
    assert.equal(details.categories[0].points, 5);
    assert.equal(details.categories[1].points, 1);
    assert.equal(details.categories[1].upset_bonus, true);

    const h2h = buildHeadToHead({
      voterA: { id: 1, nickname: 'Linsmar' },
      voterB: { id: 2, nickname: 'Amigo' },
      categories,
      nominees,
      votesA: [
        { voter_id: 1, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
        { voter_id: 1, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 21 },
      ],
      votesB: [
        { voter_id: 2, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 11 },
        { voter_id: 2, category_id: 2, will_win_nominee_id: 21, want_win_nominee_id: 21 },
      ],
    });
    assert.equal(h2h.summary.shared_will_count, 2);
    assert.equal(h2h.summary.same_will_count, 1);
    assert.equal(h2h.summary.agreement_will_pct, 50);
    assert.equal(h2h.categories[0].will_match, true);
    assert.equal(h2h.categories[1].is_divergent, true);
  });
});
